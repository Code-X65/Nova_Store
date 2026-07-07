const userModel = require('../models/user.model');

/**
 * Admin-grade roles in ascending privilege order.
 * Any user holding at least one of these can pass requireAdmin.
 * Exported so role-specific middlewares can import this list.
 */
const ADMIN_ROLES = ['ORDER_STAFF', 'INVENTORY_STAFF', 'MANAGER', 'STORE_OWNER'];

/**
 * Resolve the highest-privilege role a user holds.
 * The order in ADMIN_ROLES is the hierarchy (STORE_OWNER is highest).
 *
 * @param {string[]} roles - All roles the user holds
 * @returns {string|undefined}
 */
function resolvePrimaryRole(roles) {
  // Walk from highest to lowest privilege
  for (let i = ADMIN_ROLES.length - 1; i >= 0; i--) {
    if (roles.includes(ADMIN_ROLES[i])) return ADMIN_ROLES[i];
  }
  return undefined;
}

/**
 * requireAdmin middleware (v3 — RBAC staff roles)
 *
 * Flow:
 *  1. Read req.session.adminId — set at admin login.
 *  2. Load user from users table; reject if inactive.
 *  3. Load roles + permissions from user_roles via getUserRolesAndPermissions.
 *  4. Reject if user holds no admin-grade role.
 *  5. Attach req.admin with identity, roles, permissions and a hasRole() helper.
 *     STORE_OWNER always receives ['*'] as their permission set.
 *
 * Exports:
 *  - requireAdmin (default export)
 *  - ADMIN_ROLES  (role list constant)
 *  - resolvePrimaryRole (helper)
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (req.user) {
      const userRoles = req.user.roles || [];
      const hasAdminRole = userRoles.some(r => ADMIN_ROLES.includes(r));
      if (hasAdminRole) {
        const primaryRole = resolvePrimaryRole(userRoles);
        const isStoreOwner = primaryRole === 'STORE_OWNER';
        
        req.admin = {
          id:          req.user.id,
          email:       req.user.email,
          firstName:   req.user.first_name,
          lastName:    req.user.last_name,
          role:        primaryRole,
          roles:       userRoles,
          store_id:    req.user.store_id || null,
          permissions: isStoreOwner ? ['*'] : (req.user.permissions || []),
          hasRole:     (...roleNames) => roleNames.some(r => userRoles.includes(r))
        };
        return next();
      }
    }

    const adminId = req.session?.adminId;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    // 1. Load user
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

    // 2. Load roles + permissions
    const { roles, permissions } = await userModel.getUserRolesAndPermissions(user.id);

    // 3. Must hold at least one admin-grade role
    const hasAdminRole = roles.some(r => ADMIN_ROLES.includes(r));

    if (!hasAdminRole) {
      req.session.destroy(() => {});
      return res.status(403).json({
        success: false,
        error: 'Admin access required.'
      });
    }

    // 4. Determine highest-privilege role
    const primaryRole  = resolvePrimaryRole(roles);
    const isStoreOwner = primaryRole === 'STORE_OWNER';

    // 5. Attach req.admin
    req.admin = {
      id:         user.id,
      email:      user.email,
      firstName:  user.first_name,
      lastName:   user.last_name,
      role:       primaryRole,
      roles,
      store_id:   user.store_id || null,
      // STORE_OWNER gets wildcard; all others get their real permission set
      permissions: isStoreOwner ? ['*'] : permissions,
      /**
       * Convenience helper — check if this admin holds a specific role.
       * @param {...string} roleNames
       */
      hasRole: (...roleNames) => roleNames.some(r => roles.includes(r))
    };

    // Mirror onto req.user for compatibility with shared middlewares
    if (!req.user || Object.keys(req.user).length === 0) {
      req.user = {
        id:          user.id,
        email:       user.email,
        role:        primaryRole,
        roles,
        store_id:    user.store_id || null,
        permissions: req.admin.permissions
      };
    } else {
      req.user.store_id = user.store_id || null;
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = requireAdmin;
module.exports.ADMIN_ROLES       = ADMIN_ROLES;
module.exports.resolvePrimaryRole = resolvePrimaryRole;
