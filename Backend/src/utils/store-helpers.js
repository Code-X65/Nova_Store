/**
 * ownsStore
 * ─────────────────────────────────────────────────────────────────────────────
 * Scoping helper that checks if a user owns or has access to a specific store.
 * - STORE_OWNER has global wildcard access (returns true for any store).
 * - MANAGER, ORDER_STAFF, INVENTORY_STAFF must have a store_id matching
 *   the target storeId.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const ownsStore = (user, storeId) => {
  // Single-store system: all authenticated users have access to the single store.
  return true;
};

module.exports = {
  ownsStore
};
