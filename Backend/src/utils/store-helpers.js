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
  if (!user) return false;

  // STORE_OWNER role bypass (wildcard '*' permission also qualifies)
  const isStoreOwner = user.role === 'STORE_OWNER' ||
                       (user.roles && user.roles.includes('STORE_OWNER')) ||
                       (user.permissions && user.permissions.includes('*'));

  if (isStoreOwner) {
    return true;
  }

  return user.store_id === storeId;
};

module.exports = {
  ownsStore
};
