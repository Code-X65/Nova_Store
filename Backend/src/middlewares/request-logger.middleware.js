const logger = require('../utils/logger');

/**
 * Request logging middleware
 * Logs incoming requests and outgoing responses
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
  
  // Log incoming request
  logger.info('Incoming Request', {
    method: req.method,
    url: req.originalUrl,
    ip: ip,
    userAgent: req.get('User-Agent'),
    headers: req.headers
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