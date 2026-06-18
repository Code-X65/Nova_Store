const ErrorResponse = require('../utils/errorResponse');

/**
 * Express middleware to enforce request execution timeout.
 * Automatically exempts high-latency routes like uploads and webhooks.
 *
 * @param {number} [ms=15000] Timeout in milliseconds
 */
const requestTimeout = (ms = 15000) => {
  return (req, res, next) => {
    // Exempt routes that inherently take longer
    if (
      req.originalUrl.includes('/uploads') || 
      req.originalUrl.includes('/webhooks') || 
      req.originalUrl.includes('/accept-invite')
    ) {
      return next();
    }

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const timeoutError = new ErrorResponse('Request Timeout', 503);
        timeoutError.code = 'TIMEOUT';
        next(timeoutError);
      }
    }, ms);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};

module.exports = requestTimeout;
