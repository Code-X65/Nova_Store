const Sentry = require('@sentry/node');
const logger = require('./logger');

const dsn = process.env.SENTRY_DSN;
let isInitialized = false;

if (dsn) {
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
    });
    isInitialized = true;
    logger.info('Sentry error tracking initialized successfully.');
  } catch (err) {
    logger.error('Failed to initialize Sentry error tracker:', err.message);
  }
} else {
  logger.info('SENTRY_DSN is not set. Using local Winston logs for error tracing.');
}

/**
 * Capture and log an exception to Sentry (or Winston fallback)
 * @param {Error} error
 * @param {object} [context]
 * @param {object} [context.user] - User object
 * @param {object} [context.tags] - Key-value pair tags
 * @param {object} [context.extra] - Additional context payload
 */
const captureException = (error, context = {}) => {
  if (isInitialized) {
    Sentry.withScope((scope) => {
      if (context.tags) {
        Object.entries(context.tags).forEach(([key, val]) => scope.setTag(key, val));
      }
      if (context.extra) {
        Object.entries(context.extra).forEach(([key, val]) => scope.setExtra(key, val));
      }
      if (context.user) {
        scope.setUser(context.user);
      }
      Sentry.captureException(error);
    });
  } else {
    // Log structured fallback info via winston
    logger.error('Captured Exception (Sentry fallback):', {
      error: error.message,
      stack: error.stack,
      ...context
    });
  }
};

module.exports = {
  Sentry,
  isInitialized,
  captureException,
};
