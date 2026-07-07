const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * CSRF Protection Middleware
 * Protects session-cookie-authenticated state-modifying requests (POST, PUT, PATCH, DELETE)
 * by validating a custom request header 'x-csrf-token' against the session's token.
 * 
 * Safe methods (GET, HEAD, OPTIONS) are allowed.
 * Requests using Bearer token authentication are allowed without CSRF checks
 * since JWT headers cannot be automatically attached by standard browser cross-site requests.
 */
function csrfProtection(req, res, next) {
  // 1. Initialize CSRF token in session if not present
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // 2. Allow safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // 2.5 Bypass login endpoints
  const bypassRoutes = ['/api/v1/admin/login', '/api/v1/auth/login'];
  if (bypassRoutes.includes(req.path) || bypassRoutes.includes(req.originalUrl)) {
    return next();
  }

  // 3. Skip CSRF check if the request is authenticated via Bearer JWT token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    logger.info('CSRF Check Exempted: Bearer token auth used', { method: req.method, url: req.originalUrl });
    return next();
  }

  // 4. Validate CSRF token for cookie/session based authentication
  if (req.session && (req.session.userId || req.session.adminId)) {
    const clientToken = req.headers['x-csrf-token'] || (req.body && req.body._csrf);
    const sessionToken = req.session.csrfToken;

    if (!clientToken || clientToken !== sessionToken) {
      const error = new Error('Invalid or missing CSRF token');
      error.statusCode = 403;
      return next(error);
    }
  } else {
    // State-modifying request with no active cookie-based session
    logger.info('CSRF Check Exempted: No active session cookie', { method: req.method, url: req.originalUrl });
  }

  next();
}

module.exports = csrfProtection;
