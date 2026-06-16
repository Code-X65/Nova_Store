const permissionModel = require('../models/permission.model');
const logger = require('../utils/logger');

/**
 * Middleware to check if the admin (session-cookie based) has a specific permission.
 * For session-authenticated admins (req.admin), permission checks are bypassed,
 * treating the admin as a super-admin.
 * Falls back to req.user.id logic for customer-facing RBAC.
 * @param {string} requiredPermission - Permission key (e.g., 'user:read')
 */
const hasPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {


      const userId = req.user.id;

      if (!userId) {
        const error = new Error('Unauthorized');
        error.statusCode = 401;
        return next(error);
      }

      const userPermissions = req.user.permissions || await permissionModel.getUserPermissions(userId);

      if (userPermissions.includes('*') || userPermissions.includes(requiredPermission)) {
        return next();
      }

      logger.warn(`Permission denied: User ${userId} attempted to access ${requiredPermission}`);
      const forbiddenError = new Error('Forbidden: Insufficient permissions');
      forbiddenError.statusCode = 403;
      return next(forbiddenError);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if the admin (session-cookie based) has ANY of the provided permissions.
 * For session-authenticated admins (req.admin), permission checks are bypassed,
 * treating the admin as a super-admin.
 * Falls back to req.user.id logic for customer-facing RBAC.
 * @param {...string} perms - List of permission keys
 */
const hasAnyPermission = (...perms) => {
  return async (req, res, next) => {
    try {


      const userId = req.user.id;

      if (!userId) {
        const error = new Error('Unauthorized');
        error.statusCode = 401;
        return next(error);
      }

      const userPermissions = req.user.permissions || await permissionModel.getUserPermissions(userId);

      const hasAny = perms.some(p => userPermissions.includes(p) || userPermissions.includes('*'));

      if (hasAny) {
        return next();
      }

      const forbiddenError = new Error('Forbidden: Insufficient permissions');
      forbiddenError.statusCode = 403;
      return next(forbiddenError);
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { hasPermission, hasAnyPermission };
