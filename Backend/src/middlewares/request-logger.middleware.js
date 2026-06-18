const logger = require('../utils/logger');

/** Headers that must never appear in log output (tokens, credentials). */
const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-refresh-token',
  'x-access-token',
  'proxy-authorization',
  'x-csrf-token',
  'csrf-token',
]);

/**
 * Return a shallow copy of the headers object with sensitive fields replaced
 * by the string "[REDACTED]".
 */
function sanitizeHeaders(headers) {
  const safe = {};
  for (const [key, value] of Object.entries(headers)) {
    safe[key] = REDACTED_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return safe;
}

/**
 * Request logging middleware
 * Logs incoming requests and outgoing responses.
 * Sensitive headers (Authorization, Cookie, x-api-key, etc.) are redacted.
 */
const requestLogger = (req, res, next) => {
  // Capture start time
  const startTime = Date.now();

  // Get client IP
  const ip = req.headers['x-forwarded-for'] ||
             req.headers['x-real-ip'] ||
             req.connection.remoteAddress ||
             req.socket.remoteAddress ||
             (req.connection.socket ? req.connection.socket.remoteAddress : null);

  // Log incoming request — headers are sanitized to avoid leaking credentials
  logger.info('Incoming Request', {
    method: req.method,
    url: req.originalUrl,
    ip: ip,
    userAgent: req.get('User-Agent'),
    headers: sanitizeHeaders(req.headers),
  });

  // Log response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Outgoing Response', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: ip
    });
  });

  // Log response errors
  res.on('close', () => {
    const duration = Date.now() - startTime;
    // Only log if we haven't already logged the finish event
    if (!res.headersSent) {
      logger.info('Request Closed (no response sent)', {
        method: req.method,
        url: req.originalUrl,
        ip: ip,
        duration: `${duration}ms`
      });
    }
  });

  next();
};

module.exports = requestLogger;