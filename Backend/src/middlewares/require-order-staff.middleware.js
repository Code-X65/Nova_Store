const requireAdmin = require('./require-admin.middleware');

/**
 * requireOrderStaff middleware
 *
 * Chains after requireAdmin.
 * Allows any role that can handle order fulfillment:
 *   ORDER_STAFF, MANAGER, STORE_OWNER.
 *
 * Rejects: INVENTORY_STAFF (they have order:read via cross-access,
 *          but cannot advance the fulfillment pipeline).
 *
 * Authorises: STORE_OWNER, MANAGER, ORDER_STAFF.
 *
 * Usage:
 *   router.patch('/orders/:id', requireOrderStaff, orderController.updateStatus);
 */
const requireOrderStaff = [
  requireAdmin,
  (req, res, next) => {
    if (!req.admin?.hasRole('STORE_OWNER', 'MANAGER', 'ORDER_STAFF')) {
      return res.status(403).json({
        success: false,
        error: 'Order staff access required.'
      });
    }
    next();
  }
];

module.exports = requireOrderStaff;
