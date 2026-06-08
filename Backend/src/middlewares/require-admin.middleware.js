const adminModel = require('../models/admin.model');

/**
 * requireAdmin middleware
 *
 * Replaces the old `protect` + `admin` combo for all admin-facing routes.
 * Reads `req.session.adminId`, looks the admin up in the DB, and attaches
 * `req.admin` for downstream handlers.
 *
 * Returns 401 if:
 *  - There is no active session
 *  - The session adminId doesn't match any admin row (deleted/revoked)
 */
const requireAdmin = async (req, res, next) => {
  try {
    const adminId = req.session?.adminId;

    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const admin = await adminModel.findById(adminId);

    if (!admin) {
      // Admin was removed from the DB — destroy the stale session
      req.session.destroy(() => {});
      return res.status(401).json({ success: false, error: 'Session invalid. Please log in again.' });
    }

    // Attach safe admin object (no password_hash) for use in route handlers
    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireAdmin;
