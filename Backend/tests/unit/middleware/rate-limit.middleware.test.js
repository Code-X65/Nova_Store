const { authLimiter } = jest.requireActual('../../../src/middlewares/rate-limit.middleware');
const { redisClient } = require('../../../src/config/redis');

describe('Rate Limit Middleware & FallbackStore - Unit Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    if (authLimiter.store && typeof authLimiter.store.resetKey === 'function') {
      await authLimiter.store.resetKey('127.0.0.1');
      await authLimiter.store.resetKey('127.0.0.2');
    }
  });

  it('should default to MemoryStore and pass requests when under the limit', async () => {
    redisClient.isOpen = false;
    
    const req = { 
      ip: '127.0.0.1',
      headers: {},
      app: {
        get: jest.fn().mockReturnValue(false)
      }
    };
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    const next = jest.fn();

    await authLimiter(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should trigger rateLimitHandler with 429 when limit is exceeded', async () => {
    redisClient.isOpen = false;
    const req = { 
      ip: '127.0.0.2',
      headers: {},
      app: {
        get: jest.fn().mockReturnValue(false)
      }
    };
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    const next = jest.fn();

    // Call 16 times to exceed limit of 15
    for (let i = 0; i < 16; i++) {
      await authLimiter(req, res, next);
    }

    const lastCallErr = next.mock.calls[15][0];
    expect(lastCallErr).toBeDefined();
    expect(lastCallErr.statusCode).toBe(429);
    expect(lastCallErr.name).toBe('RateLimitError');
  });

  it('should attempt to use RedisStore when Redis is open', async () => {
    redisClient.isOpen = true;
    
    // Mock the sendCommand command router:
    // SCRIPT LOAD returns SHA string, EVALSHA returns script response [totalHits, timeToExpire]
    redisClient.sendCommand.mockImplementation((cmd) => {
      if (cmd && cmd[0] === 'SCRIPT' && cmd[1] === 'LOAD') {
        return Promise.resolve('mock-sha-hash');
      }
      if (cmd && cmd[0] === 'EVALSHA') {
        return Promise.resolve([1, 10000]);
      }
      return Promise.resolve(null);
    });

    const req = { 
      ip: '127.0.0.1',
      headers: {},
      app: {
        get: jest.fn().mockReturnValue(false)
      }
    };
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    const next = jest.fn();

    await authLimiter(req, res, next);
    expect(redisClient.sendCommand).toHaveBeenCalled();
  });
});
