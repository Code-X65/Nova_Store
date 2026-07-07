const requireAdmin = require('./require-admin.middleware');

/**
 * requireInventoryStaff middleware
 *
 * Chains after requireAdmin.
 * Allows any role with inventory management rights:
 *   INVENTORY_STAFF, MANAGER, STORE_OWNER.
 *
 * Rejects: ORDER_STAFF (they can read orders but cannot touch inventory).
 *
 * Authorises: STORE_OWNER, MANAGER, INVENTORY_STAFF.
 *
 * Usage:
 *   router.post('/inventory/adjust', requireInventoryStaff, inventoryController.adjust);
 */
const requireInventoryStaff = [
  requireAdmin,
  (req, res, next) => {
    if (!req.admin?.hasRole('STORE_OWNER', 'MANAGER', 'INVENTORY_STAFF')) {
      return res.status(403).json({
        success: false,
        error: 'Inventory staff access required.'
      });
    }
    next();
  }
];

module.exports = requireInventoryStaff;
