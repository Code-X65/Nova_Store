const requireAdmin = require('./require-admin.middleware');

/**
 * requireManager middleware
 *
 * Chains after requireAdmin.
 * Allows STORE_OWNER or MANAGER — the two roles with full catalog and
 * order management access.
 *
 * Authorises: STORE_OWNER, MANAGER.
 * Rejects:    ORDER_STAFF, INVENTORY_STAFF.
 *
 * Usage:
 *   router.post('/products', requireManager, productController.create);
 */
const requireManager = [
  requireAdmin,
  (req, res, next) => {
    if (!req.admin?.hasRole('STORE_OWNER', 'MANAGER')) {
      return res.status(403).json({
        success: false,
        error: 'Manager access required.'
      });
    }
    next();
  }
];

module.exports = requireManager;
