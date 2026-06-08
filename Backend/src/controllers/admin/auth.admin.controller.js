const adminAuthService = require('../../services/admin-auth.service');

/**
 * POST /api/v1/admin/login
 * Authenticates the admin with email + password, creates a session cookie.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const admin = await adminAuthService.login(email, password, ip);

    // Regenerate session to prevent session-fixation attacks
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.adminId = admin.id;
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);

        return res.status(200).json({
          success: true,
          message: 'Login successful.',
          data: { email: admin.email },
        });
      });
    });
  } catch (error) {
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
    data: { email: req.admin.email },
  });
};

module.exports = { login, logout, verify };
