const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/config/supabase');
const { redisClient } = require('../../src/config/redis');

// Mock Rate Limit middleware to allow fast testing
jest.mock('../../src/middlewares/rate-limit.middleware', () => ({
  authLimiter: (req, res, next) => next(),
  adminLoginLimiter: (req, res, next) => next(),
  resetLimiter: (req, res, next) => next(),
  refreshLimiter: (req, res, next) => next(),
  adminLimiter: (req, res, next) => next(),
  apiLimiter: (req, res, next) => next(),
  inviteLimiter: (req, res, next) => next(),
  healthLimiter: (req, res, next) => next()
}));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  totalmem: () => 16000000000,
  freemem: () => 8000000000
}));

jest.mock('../../src/config/supabase', () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn()
}));

jest.mock('../../src/config/redis', () => ({
  redisClient: {
    ping: jest.fn().mockResolvedValue('PONG'),
    info: jest.fn().mockResolvedValue('redis_version:7.0.0'),
    connect: jest.fn(),
    on: jest.fn(),
    zAdd: jest.fn(),
    hSet: jest.fn(),
    hDel: jest.fn(),
    zRem: jest.fn()
  },
  connectRedis: jest.fn()
}));

jest.mock('../../src/services/email.service', () => ({
  transporter: {
    verify: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../../src/services/sms.service', () => ({
  accountSid: 'AC123',
  client: {
    api: {
      v2010: {
        accounts: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue({ status: 'active' })
      }
    }
  }
}));

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({})
});

describe('Health & Metrics Endpoint Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 UP status when all services are healthy', async () => {
      supabase.limit.mockResolvedValueOnce({ data: [{ id: 1 }], error: null });

      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.services.database.status).toBe('UP');
      expect(res.body.data.services.redis.status).toBe('UP');
    });

    it('should return 503 DEGRADED/DOWN status if database query fails', async () => {
      supabase.limit.mockRejectedValueOnce(new Error('DB Query Failed'));

      const res = await request(app).get('/health');
      expect(res.status).toBe(503);
      expect(res.body.data.status).toBe('DEGRADED');
      expect(res.body.data.services.database.status).toBe('DOWN');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health status', async () => {
      supabase.limit.mockResolvedValueOnce({ data: [{ id: 1 }], error: null });

      const res = await request(app).get('/health/detailed');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checks.database.status).toBe('UP');
      expect(res.body.data.checks.redis.status).toBe('UP');
      expect(res.body.data.checks.memory.status).toBe('UP');
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 READY when DB and Redis are ready', async () => {
      supabase.limit.mockResolvedValueOnce({ data: [{ id: 1 }], error: null });

      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('READY');
      expect(res.body.data.checks.database.status).toBe('READY');
      expect(res.body.data.checks.redis.status).toBe('READY');
    });

    it('should return 503 NOT_READY if Redis ping fails', async () => {
      supabase.limit.mockResolvedValueOnce({ data: [{ id: 1 }], error: null });
      redisClient.ping.mockRejectedValueOnce(new Error('Redis connection lost'));

      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.data.status).toBe('NOT_READY');
      expect(res.body.data.checks.redis.status).toBe('NOT_READY');
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 ALIVE status', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ALIVE');
    });
  });

  describe('GET /health/metrics', () => {
    it('should return scrapeable Prometheus metrics format', async () => {
      const res = await request(app).get('/health/metrics');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toContain('http_requests_total');
    });
  });
});
