require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

jest.setTimeout(30000);


// Mock rate limiting for faster tests
jest.mock('../../src/middlewares/rate-limit.middleware', () => ({
  authLimiter: (req, res, next) => next(),
  adminLoginLimiter: (req, res, next) => next(),
  swaggerLoginLimiter: (req, res, next) => next(),
  resetLimiter: (req, res, next) => next(),
  refreshLimiter: (req, res, next) => next(),
  adminLimiter: (req, res, next) => next(),
  apiLimiter: (req, res, next) => next(),
  inviteLimiter: (req, res, next) => next(),
  healthLimiter: (req, res, next) => next(),
}));

// Mock external services
jest.mock('../../src/services/email.service');
jest.mock('../../src/services/sms.service');
jest.mock('../../src/services/notification.service');
jest.mock('../../src/services/audit.service');

// Mock session store to prevent real database connections during tests
jest.mock('connect-pg-simple', () => {
  return (session) => {
    const Store = session.Store;
    class MockStore extends Store {
      constructor() {
        super();
      }
      get(sid, cb) { cb(null, null); }
      set(sid, sess, cb) { cb(null); }
      destroy(sid, cb) { cb(null); }
    }
    return MockStore;
  };
});

// Mock phone verification database model to prevent outbound network/DB timeouts
jest.mock('../../src/models/phone_verification.model', () => ({
  createPhoneVerificationToken: jest.fn().mockResolvedValue(),
  findByPhoneToken: jest.fn().mockResolvedValue(),
  markAsUsed: jest.fn().mockResolvedValue(),
  findLatestByUserId: jest.fn().mockResolvedValue(),
}));

// Mock redis client globally
jest.mock('../../src/config/redis', () => ({
  redisClient: {
    isOpen: false,
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    sAdd: jest.fn().mockResolvedValue(1),
    sRem: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockResolvedValue([]),
    sendCommand: jest.fn(),
    multi: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    }),
  },
  connectRedis: jest.fn().mockResolvedValue(),
}));

// Mock Supabase globally to prevent integration tests from attempting real connection to Supabase cloud
jest.mock('../../src/config/supabase', () => {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    update: jest.fn().mockResolvedValue({ data: [], error: null }),
    delete: jest.fn().mockResolvedValue({ data: [], error: null }),
    then: jest.fn((resolve) => resolve({ data: [], error: null }))
  };

  const client = {
    from: jest.fn().mockReturnValue(mockQuery),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
    }
  };

  return {
    supabase: client,
    supabaseAdmin: client,
    from: client.from,
    rpc: client.rpc,
    auth: client.auth
  };
});