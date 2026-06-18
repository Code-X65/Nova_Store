const logger = require('../utils/logger');

/**
 * Permission middleware (v2)
 *
 * Works for both:
 *   - Admin routes: reads req.admin.permissions (set by requireAdmin middleware)
 *   - User routes: reads req.user.permissions (set by auth.middleware)
 *
 * Permission resolution:
 *   - SUPER_ADMIN has req.admin.permissions = ['*'] → always passes
 *   - ADMIN has real permission slugs → must match exactly
 *   - Customer (req.user) has real permission slugs or empty array
 *
 * NO wildcard bypass for ordinary admins — they must have the exact permission.
 */

/**
 * Resolve the current actor's permission list from the request.
 * Priority: req.admin (session admin) → req.user (JWT user)
 *
 * @param {import('express').Request} req
 * @returns {{ userId: string, permissions: string[] } | null}
 */
function resolveActor(req) {
  if (req.admin) {
    return {
      userId: req.admin.id,
      permissions: req.admin.permissions || []
    };
  }
  if (req.user) {
    return {
      userId: req.user.id,
      permissions: req.user.permissions || []
    };
  }
  return null;
}

/**
 * Check whether a permission set satisfies a required permission.
 * Wildcard '*' grants everything.
 *
 * @param {string[]} permissions
 * @param {string}   required
 * @returns {boolean}
 */
function check(permissions, required) {
  return permissions.includes('*') || permissions.includes(required);
}

/**
 * hasPermission(requiredPermission)
 *
 * Gate that allows the request only if the actor has the specified permission.
 *
 * @param {string} requiredPermission - e.g. 'product:create'
 */
const hasPermission = (requiredPermission) => {
  return (req, res, next) => {
    const actor = resolveActor(req);

    if (!actor) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    if (check(actor.permissions, requiredPermission)) {
      return next();
    }

    logger.warn(`Permission denied: user ${actor.userId} requires '${requiredPermission}'`);
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Insufficient permissions.'
    });
  };
};

/**
 * hasAnyPermission(...perms)
 *
 * Gate that allows the request if the actor has ANY of the listed permissions.
 *
 * @param {...string} perms - e.g. 'product:read', 'product:create'
 */
const hasAnyPermission = (...perms) => {
  return (req, res, next) => {
    const actor = resolveActor(req);

    if (!actor) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const hasAny = perms.some(p => check(actor.permissions, p));

    if (hasAny) {
      return next();
    }

    logger.warn(`Permission denied: user ${actor.userId} requires one of [${perms.join(', ')}]`);
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Insufficient permissions.'
    });
  };
};

module.exports = { hasPermission, hasAnyPermission };
