const { ownsStore } = require('../utils/store-helpers');

/**
 * Middleware to enforce store-scoping access control.
 * Ensures:
 * 1. An active store context (req.store) has been resolved.
 * 2. The authenticated user (req.admin or req.user) has permission to access the store.
 * - STORE_OWNER has global wildcard access (bypass via ownsStore check).
 * - MANAGER, ORDER_STAFF, INVENTORY_STAFF must have a store_id matching req.store.id.
 */
const scopeToStore = (req, res, next) => {
  try {
    if (!req.store) {
      const err = new Error('Store context not resolved. Make sure storeContext middleware is registered.');
      err.statusCode = 500;
      return next(err);
    }

    const user = req.admin || req.user;
    if (!user) {
      const err = new Error('Unauthorized: Authentication required.');
      err.statusCode = 401;
      return next(err);
    }

    if (!ownsStore(user, req.store.id)) {
      const err = new Error('Forbidden: You do not have permission to access data for this store.');
      err.statusCode = 403;
      return next(err);
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = scopeToStore;
