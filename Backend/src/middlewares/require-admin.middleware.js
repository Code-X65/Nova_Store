const adminModel = require('../models/admin.model');
const userModel = require('../models/user.model');
const permissionModel = require('../models/permission.model');

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

    if (!admin || !admin.is_active) {
      // Admin was removed or deactivated — destroy the stale session
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        error: admin ? 'Account deactivated. Please contact support.' : 'Session invalid. Please log in again.'
      });
    }

    // Attach safe admin object (no password_hash) for use in route handlers
    req.admin = admin;
    
    // Resolve administrative permissions by checking if they are linked to the public.users table.
    // Falls back to super-admin wildcard ['*'] for standalone setup/compatibility.
    let permissions = ['*'];
    try {
      const matchingUser = await userModel.findByEmail(admin.email);
      if (matchingUser) {
        const dbPerms = await permissionModel.getUserPermissions(matchingUser.id);
        if (dbPerms && dbPerms.length > 0) {
          permissions = dbPerms;
        }
      }
    } catch (err) {
      console.error('[requireAdmin] Failed to load admin permissions from users table:', err.message);
    }

    req.user = req.user || {
      id: admin.id,
      email: admin.email,
      role: 'admin',
      roles: ['admin'],
      permissions
    };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireAdmin;
