const { idempotencyStore } = require('../../../src/utils/idempotency-store');
const { redisClient } = require('../../../src/config/redis');
const supabase = require('../../../src/config/supabase');

// Mock external clients
jest.mock('../../../src/config/redis', () => ({
  redisClient: {
    isOpen: false,
    isReady: false,
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn()
  }
}));

jest.mock('../../../src/config/supabase', () => ({
  from: jest.fn()
}));

describe('IdempotencyStore', () => {
  let mockSupabaseQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyStore.clearMemoryStore();

    // Default Supabase query mock structure
    mockSupabaseQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis()
    };

    supabase.from.mockReturnValue(mockSupabaseQuery);

    // Default Redis state: closed
    redisClient.isOpen = false;
    redisClient.isReady = false;
  });

  describe('Tier 1: Redis is active', () => {
    beforeEach(() => {
      redisClient.isOpen = true;
      redisClient.isReady = true;
    });

    it('should acquire lock via Redis set NX', async () => {
      redisClient.set.mockResolvedValue('OK');

      const res = await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');

      expect(redisClient.set).toHaveBeenCalledWith(
        'idempotency:test-key',
        expect.stringContaining('"status":"started"'),
        { NX: true, EX: 86400 }
      );
      expect(res).toEqual({ status: 'new' });
    });

    it('should return started status if key is currently executing in Redis', async () => {
      redisClient.set.mockResolvedValue(null); // Key already exists
      redisClient.get.mockResolvedValue(JSON.stringify({
        status: 'started',
        requestBodyHash: 'hash123'
      }));

      const res = await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');

      expect(res).toEqual({
        status: 'started',
        requestBodyHash: 'hash123'
      });
    });

    it('should resolve key in Redis', async () => {
      await idempotencyStore.resolve('test-key', 201, { ok: true });

      expect(redisClient.set).toHaveBeenCalledWith(
        'idempotency:test-key',
        JSON.stringify({ status: 'completed', responseStatus: 201, responseBody: { ok: true } }),
        { EX: 86400 }
      );
    });

    it('should delete key in Redis on release', async () => {
      await idempotencyStore.release('test-key');

      expect(redisClient.del).toHaveBeenCalledWith('idempotency:test-key');
    });
  });

  describe('Tier 2: Redis is inactive, PostgreSQL is active', () => {
    it('should lock key by inserting row in PostgreSQL', async () => {
      // Fetch: not found
      mockSupabaseQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
      // Insert: successful
      mockSupabaseQuery.select.mockImplementation((arg) => {
        if (arg === '*') return mockSupabaseQuery;
        return Promise.resolve({ data: [{ id: 1 }], error: null });
      });

      const res = await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');

      expect(supabase.from).toHaveBeenCalledWith('idempotency_keys');
      expect(mockSupabaseQuery.insert).toHaveBeenCalledWith([expect.objectContaining({
        key: 'test-key',
        request_body_hash: 'hash123',
        response_status: 0
      })]);
      expect(res).toEqual({ status: 'new' });
    });

    it('should handle unique violation and return started status', async () => {
      // Fetch: not found
      mockSupabaseQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
      // Insert: fails with unique violation code 23505
      mockSupabaseQuery.select.mockImplementation((arg) => {
        if (arg === '*') return mockSupabaseQuery;
        return Promise.resolve({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' }
        });
      });
      // Re-fetch: returns executing row
      mockSupabaseQuery.single.mockResolvedValue({
        data: { response_status: 0, request_body_hash: 'hash123' },
        error: null
      });

      const res = await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');

      expect(res).toEqual({
        status: 'started',
        requestBodyHash: 'hash123'
      });
    });

    it('should resolve key in PostgreSQL', async () => {
      mockSupabaseQuery.select.mockResolvedValue({ data: [], error: null });

      await idempotencyStore.resolve('test-key', 200, { success: true });

      expect(mockSupabaseQuery.update).toHaveBeenCalledWith({
        response_status: 200,
        response_body: { success: true }
      });
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('key', 'test-key');
    });

    it('should delete key in PostgreSQL on release', async () => {
      await idempotencyStore.release('test-key');

      expect(mockSupabaseQuery.delete).toHaveBeenCalled();
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('key', 'test-key');
    });
  });

  describe('Tier 3: Redis and PostgreSQL fail, using In-Memory Fallback', () => {
    beforeEach(() => {
      // PostgreSQL throws error
      supabase.from.mockImplementation(() => {
        throw new Error('Database connection timeout');
      });
    });

    it('should lock key in memory Map', async () => {
      const res = await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');

      expect(res).toEqual({ status: 'new' });

      // Lock again: should return started
      const res2 = await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');
      expect(res2).toEqual({
        status: 'started',
        requestBodyHash: 'hash123'
      });
    });

    it('should resolve key in memory Map', async () => {
      // Establish lock first
      await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');

      // Resolve
      await idempotencyStore.resolve('test-key', 200, { data: 'memory-saved' });

      // Check lock state again
      const res = await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');
      expect(res).toEqual({
        status: 'completed',
        responseStatus: 200,
        responseBody: { data: 'memory-saved' },
        requestBodyHash: 'hash123'
      });
    });

    it('should release key in memory Map', async () => {
      // Lock
      await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');

      // Release
      await idempotencyStore.release('test-key');

      // Lock again: should be new
      const res = await idempotencyStore.lock('test-key', 'hash123', 'user1', '/path', 'POST');
      expect(res).toEqual({ status: 'new' });
    });
  });
});
