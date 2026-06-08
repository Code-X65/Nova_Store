const express = require('express');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const adminAuditController = require('../../controllers/admin/audit.controller');

const router = express.Router();

// All routes require authentication
router.use(requireAdmin);
// Require admin permissions for audit access
router.use(hasPermission('audit:read'));

/**
 * @swagger
 * tags:
 *   name: Admin Audit
 *   description: Admin authentication audit logs
 */

/**
 * @swagger
 * /admin/audit/auth:
 *   get:
 *     summary: Get authentication audit logs
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Authentication audit logs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/auth', adminAuditController.getAuthAuditLogs);

/**
 * @swagger
 * /admin/audit/admin-auth:
 *   get:
 *     summary: Get admin authentication audit logs
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Admin authentication audit logs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/admin-auth', adminAuditController.getAdminAuthAuditLogs);

/**
 * @swagger
 * /admin/audit/stats:
 *   get:
 *     summary: Get audit log statistics
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit log statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/stats', adminAuditController.getAuditStats);

module.exports = router;