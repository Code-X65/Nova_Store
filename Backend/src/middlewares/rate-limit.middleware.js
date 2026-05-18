const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { redisClient } = require('../config/redis');

// Helper to determine store if redis is connected
const getStore = () => {
  if (redisClient && redisClient.status === 'ready') {
    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    });
  }
  return undefined; // Fallback to memory
};

// 1. Auth endpoints – strict (5 per 15min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  store: getStore()
});

// 2. Password reset – very strict (3 per hour per IP)
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many password reset attempts. Please try again later.' },
  store: getStore()
});

// 3. Refresh token endpoint – per-user limit (10 per 15min)
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user ? `refresh:${req.user.id}` : `refresh:${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`,
  message: { success: false, error: 'Too many token refresh attempts.' },
  store: getStore()
});

// 4. Admin endpoints – per-user (100 per 15min)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user ? `admin:${req.user.id}` : `admin:${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`,
  message: { success: false, error: 'Admin API rate limit exceeded.' },
  store: getStore()
});

// 5. General API – default (200 per 15min per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  store: getStore()
});

module.exports = {
  authLimiter,
  resetLimiter,
  refreshLimiter,
  adminLimiter,
  apiLimiter
};
