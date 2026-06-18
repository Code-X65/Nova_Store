const userModel = require('../models/user.model');

/**
 * requireAdmin middleware (REWRITTEN — v2)
 *
 * Replaces the legacy admins-table lookup with a users + user_roles lookup.
 *
 * Flow:
 *  1. Read req.session.adminId  — the user UUID stored at login.
 *  2. Load user from users table.
 *  3. Verify user has ADMIN or SUPER_ADMIN role via user_roles.
 *  4. Load actual permissions from role_permissions (no wildcard bypass for ADMIN).
 *     SUPER_ADMIN always gets ['*'].
 *  5. Attach req.admin = { id, email, firstName, lastName, role, roles, permissions }.
 *
 * Security:
 *  - No wildcard fallback for ADMIN — real permissions only.
 *  - SUPER_ADMIN wildcard is authoritative via role_permissions seeded in migration 045.
 *  - Stale sessions (deactivated/non-admin users) are destroyed.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const adminId = req.session?.adminId;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    // 1. Load user from users table
    const user = await userModel.findById(adminId);

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        error: 'Session invalid. Please log in again.'
      });
    }

    if (!user.is_active) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        error: 'Account deactivated. Please contact support.'
      });
    }

    // 2. Load roles + permissions from user_roles
    const { roles, permissions } = await userModel.getUserRolesAndPermissions(user.id);

    // 3. Verify the user has at least one admin-grade role
    const hasAdminRole = roles.some(r => r === 'ADMIN' || r === 'SUPER_ADMIN');

    if (!hasAdminRole) {
      req.session.destroy(() => {});
      return res.status(403).json({
        success: false,
        error: 'Admin access required.'
      });
    }

    // 4. Determine the primary (highest) role
    const isSuperAdmin = roles.includes('SUPER_ADMIN');
    const primaryRole = isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN';

    // 5. Attach req.admin — SUPER_ADMIN always gets wildcard, others get real permissions only
    req.admin = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: primaryRole,
      roles,
      permissions: isSuperAdmin ? ['*'] : permissions
    };

    // Also set req.user for compatibility with shared middlewares (auth.middleware.js etc.)
    req.user = req.user || {
      id: user.id,
      email: user.email,
      role: primaryRole,
      roles,
      permissions: req.admin.permissions
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireAdmin;
