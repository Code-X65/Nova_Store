const permissionModel = require('../models/permission.model');
const logger = require('../utils/logger');

/**
 * Middleware to check if the user has a specific permission.
 * Supports wildcard '*' for super-admins.
 * @param {string} requiredPermission - Permission key (e.g., 'user:read')
 */
const hasPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      // If we've already attached permissions in 'protect' middleware, use them
      // Otherwise, fetch them now
      const userPermissions = req.user.permissions || await permissionModel.getUserPermissions(userId);

      if (userPermissions.includes('*') || userPermissions.includes(requiredPermission)) {
        return next();
      }

      logger.warn(`Permission denied: User ${userId} attempted to access ${requiredPermission}`);
      const error = new Error('Forbidden: Insufficient permissions');
      error.statusCode = 403;
      return next(error);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if the user has ANY of the provided permissions.
 * @param {...string} perms - List of permission keys
 */
const hasAnyPermission = (...perms) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userPermissions = req.user.permissions || await permissionModel.getUserPermissions(userId);

      const hasAny = perms.some(p => userPermissions.includes(p) || userPermissions.includes('*'));

      if (hasAny) {
        return next();
      }

      const error = new Error('Forbidden: Insufficient permissions');
      error.statusCode = 403;
      return next(error);
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { hasPermission, hasAnyPermission };
