const adminAuthService = require('../../services/admin-auth.service');
const jwt = require('jsonwebtoken');
const { SINGLE_STORE_ID } = require('../../config/store');

/**
 * POST /api/v1/admin/login
 * Authenticates the admin with email + password, creates a session cookie
 * AND returns a signed JWT access token for use with Bearer-auth protected routes.
 */
const login = async (req, res, next) => {
  try {
    const { email, password, twoFactorToken, recoveryCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const admin = await adminAuthService.login(email, password, ip, userAgent, twoFactorToken, recoveryCode);

    // Regenerate session to prevent session-fixation attacks
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.adminId = admin.id;
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        if (res.headersSent) return;

        // Generate a short-lived JWT access token for Bearer-auth endpoints
        const accessToken = jwt.sign(
          { id: admin.id, email: admin.email, role: admin.role },
          process.env.JWT_ACCESS_SECRET,
          { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '8h' }
        );

          return res.status(200).json({
            success: true,
            message: 'Login successful.',
            data: {
              id:          admin.id,
              email:       admin.email,
              name:        `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Admin User',
              role:        admin.role,
              store_id:    SINGLE_STORE_ID,
              storeName:   'Nova Store',
              accessToken,
              tokenType:   'Bearer',
              expiresIn:   process.env.JWT_ACCESS_EXPIRES_IN || '8h',
            },
          });
      });
    });
  } catch (error) {
    if (res.headersSent) return;
    if (error.message === 'Account deactivated') {
      return res.status(403).json({ success: false, error: 'Your account has been deactivated. Please contact support.' });
    }
    if (error.message === 'Account locked') {
      return res.status(403).json({ success: false, error: 'Admin account is locked due to multiple failed login attempts. Try again later.' });
    }
    if (error.code === 'TWO_FACTOR_REQUIRED') {
      return res.status(401).json({ success: false, error: 'Two-factor authentication code required.', code: 'TWO_FACTOR_REQUIRED' });
    }
    if (error.message === 'Invalid two-factor authentication code') {
      return res.status(401).json({ success: false, error: 'Invalid two-factor authentication code.' });
    }
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }
    next(error);
  }
};


/**
 * POST /api/v1/admin/logout
 * Destroys the session and clears the cookie.
 */
const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);

    // Clear the session cookie on the client
    res.clearCookie('connect.sid', { path: '/' });
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  });
};

/**
 * GET /api/v1/admin/verify
 * Returns the current admin's email if the session is valid, 401 otherwise.
 * Used by the frontend to confirm a live session without re-logging in.
 */
const verify = async (req, res) => {
  // req.admin is attached by requireAdmin middleware
  return res.status(200).json({
    success: true,
    data: { 
      id: req.admin.id,
      email: req.admin.email,
      name: `${req.admin.firstName || ''} ${req.admin.lastName || ''}`.trim() || 'Admin User',
      role: req.admin.role,
      store_id: SINGLE_STORE_ID,
      storeName: 'Nova Store',
      permissions: req.admin.permissions
    },
  });
};

module.exports = { login, logout, verify };
