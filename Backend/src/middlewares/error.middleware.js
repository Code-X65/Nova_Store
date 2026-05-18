const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${err.stack}`);
  
  // Default error
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'SERVER_ERROR';
  let message = err.message || 'Internal server error';
  let details = err.details || [];
  
  // Handle Specific Error Types
  if (err.isJoi) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.details.map(d => ({
      field: d.path[0],
      message: d.message
    }));
  } else if (err.name === 'UnauthorizedError' || err.message === 'jwt expired' || err.message === 'invalid token') {
    statusCode = 401;
    errorCode = 'AUTHENTICATION_ERROR';
    message = 'Invalid authentication credentials';
  } else if (err.name === 'ForbiddenError' || statusCode === 403) {
    statusCode = 403;
    errorCode = 'AUTHORIZATION_ERROR';
    message = err.message || 'Insufficient permissions';
  } else if (err.name === 'RateLimitError' || statusCode === 429) {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_ERROR';
    message = 'Too many requests, please try again later';
  } else if (statusCode === 404) {
    errorCode = 'RESOURCE_NOT_FOUND';
  } else if (statusCode === 400 && !err.isJoi) {
    errorCode = 'VALIDATION_ERROR';
  } else if (statusCode === 409) {
    errorCode = 'CONFLICT_ERROR';
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message,
      details: details
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl || req.path
  });
};

module.exports = errorHandler;
