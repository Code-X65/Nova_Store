require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// Mock rate limiting for faster tests
jest.mock('../../src/middlewares/rate-limit.middleware', () => ({
  authLimiter: (req, res, next) => next(),
  resetLimiter: (req, res, next) => next(),
  refreshLimiter: (req, res, next) => next(),
  adminLimiter: (req, res, next) => next(),
  apiLimiter: (req, res, next) => next(),
}));

// Mock external services
jest.mock('../../src/services/email.service');
jest.mock('../../src/services/sms.service');
jest.mock('../../src/services/notification.service');
jest.mock('../../src/services/audit.service');

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
    multi: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    }),
  },
  connectRedis: jest.fn().mockResolvedValue(),
}));