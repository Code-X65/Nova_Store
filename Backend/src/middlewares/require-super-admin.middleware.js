const requireAdmin = require('./require-admin.middleware');

/**
 * requireSuperAdmin middleware
 *
 * Chains after requireAdmin.
 * Rejects the request unless req.admin.role === 'SUPER_ADMIN'.
 *
 * Usage:
 *   router.post('/invite', requireSuperAdmin, invitationController.createInvitation);
 *
 * Or as an array:
 *   [requireAdmin, requireSuperAdmin]
 */
const requireSuperAdmin = [
  requireAdmin,
  (req, res, next) => {
    if (req.admin?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'SuperAdmin access required.'
      });
    }
    next();
  }
];

module.exports = requireSuperAdmin;
