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
  // Single-store system: scoping is no longer required.
  // This middleware is kept as a silent no-op for backward compatibility.
  next();
};

module.exports = scopeToStore;
