const ErrorResponse = require('../utils/errorResponse');

const requestTimeout = (ms = 15000) => {
  return (req, res, next) => {
    if (
      req.originalUrl.includes('/uploads') ||
      req.originalUrl.includes('/webhooks') ||
      req.originalUrl.includes('/accept-invite')
    ) {
      return next();
    }

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'The request timed out. Please check your connection and try again.',
          code: 'TIMEOUT'
        });
      }
    }, ms);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};

module.exports = requestTimeout;
