const requireAdmin = require('./require-admin.middleware');

/**
 * requireStoreOwner middleware
 *
 * Chains after requireAdmin.
 * Rejects the request unless the authenticated admin holds the STORE_OWNER role.
 *
 * Usage (as array — preferred):
 *   router.post('/invitations', requireStoreOwner, controller.create);
 *
 * Authorises: STORE_OWNER only.
 */
const requireStoreOwner = [
  requireAdmin,
  (req, res, next) => {
    if (!req.admin?.hasRole('STORE_OWNER')) {
      return res.status(403).json({
        success: false,
        error: 'Store Owner access required.'
      });
    }
    next();
  }
];

module.exports = requireStoreOwner;
