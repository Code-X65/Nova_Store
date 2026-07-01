const { rateLimit, MemoryStore } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redisClient } = require('../config/redis');

// Custom error handler to integrate with central error.middleware.js
const rateLimitHandler = (req, res, next, options) => {
  const error = new Error('Too many requests, please try again later');
  error.name = 'RateLimitError';
  error.statusCode = 429;
  next(error);
};

// Fallback Store that dynamically delegates to RedisStore if Redis is connected,
// and falls back to the in-memory MemoryStore if Redis is unavailable.
class FallbackStore {
  constructor(name) {
    this.redisStore = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: `rl:${name}:`,
    });
    this.memoryStore = new MemoryStore();
    this.redisStoreInitialized = false;
    this.options = null;
  }

  init(options) {
    this.options = options;
    if (typeof this.memoryStore.init === 'function') {
      this.memoryStore.init(options);
    }
  }

  get activeStore() {
    if (redisClient && redisClient.isOpen) {
      if (!this.redisStoreInitialized) {
        try {
          if (typeof this.redisStore.init === 'function') {
            this.redisStore.init(this.options);
          }
          this.redisStoreInitialized = true;
        } catch (err) {
          console.warn('Failed to initialize Redis rate limit store:', err.message);
          return this.memoryStore;
        }
      }
      return this.redisStore;
    }
    return this.memoryStore;
  }

  async increment(key) {
    try {
      return await this.activeStore.increment(key);
    } catch (err) {
      console.warn('Rate limit store error, falling back to memory:', err.message);
      return await this.memoryStore.increment(key);
    }
  }

  async decrement(key) {
    try {
      return await this.activeStore.decrement(key);
    } catch (err) {
      return await this.memoryStore.decrement(key);
    }
  }

  async resetKey(key) {
    try {
      return await this.activeStore.resetKey(key);
    } catch (err) {
      return await this.memoryStore.resetKey(key);
    }
  }
}

// Helper function to create rate limiters with unique store instances
const createLimiter = (name, options) => {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitHandler,
    store: new FallbackStore(name),
    validate: { singleCount: false },
    ...options,
  });
};

// Define the limiters
const authLimiter = createLimiter('auth', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15,
});

const adminLoginLimiter = createLimiter('admin-login', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
});

const swaggerLoginLimiter = createLimiter('swagger-login', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
});

const resetLimiter = createLimiter('reset', {
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
});

const refreshLimiter = createLimiter('refresh', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
});

const adminLimiter = createLimiter('admin', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
});

const apiLimiter = createLimiter('api', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,
});

const inviteLimiter = createLimiter('invite', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15,
});

const healthLimiter = createLimiter('health', {
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 30,
});

module.exports = {
  authLimiter,
  adminLoginLimiter,
  swaggerLoginLimiter,
  resetLimiter,
  refreshLimiter,
  adminLimiter,
  apiLimiter,
  inviteLimiter,
  healthLimiter,
};