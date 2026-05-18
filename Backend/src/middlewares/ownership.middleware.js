const logger = require('../utils/logger');

/**
 * Middleware to verify that the resource being accessed belongs to the authenticated user.
 * @param {Object} model - The database model (e.g., AddressModel)
 * @param {string} paramName - The name of the route parameter containing the ID (e.g., 'id')
 * @param {string} userIdField - The field in the model that stores the user's ID (default: 'user_id')
 */
const authorizeResource = (model, paramName = 'id', userIdField = 'user_id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const userId = req.user.id;

      if (!resourceId) {
        const error = new Error('Resource ID is missing from request');
        error.statusCode = 400;
        return next(error);
      }

      const resource = await model.findById(resourceId);

      if (!resource) {
        const error = new Error('Resource not found');
        error.statusCode = 404;
        return next(error);
      }

      if (resource[userIdField] !== userId) {
        logger.warn(`Unauthorized access attempt by user ${userId} on resource ${resourceId}`);
        const error = new Error('Forbidden: You do not have permission to access this resource');
        error.statusCode = 403;
        return next(error);
      }

      // Attach resource to request for use in controller if needed
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = authorizeResource;
