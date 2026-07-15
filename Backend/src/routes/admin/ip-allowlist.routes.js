const express = require('express');
const router = express.Router();
const ipAllowlistController = require('../../controllers/admin/ip-allowlist.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin IP Allowlist
 *   description: Manage allowed IP ranges for admin access
 */

/**
 * @swagger
 * /admin/ip-allowlist:
 *   get:
 *     summary: List allowed IP ranges for admin access
 *     tags: [Admin IP Allowlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of allowlist entries
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', hasPermission('rbac:read'), ipAllowlistController.list);

/**
 * @swagger
 * /admin/ip-allowlist:
 *   post:
 *     summary: Add an IP range to the admin allowlist
 *     tags: [Admin IP Allowlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ip_cidr]
 *             properties:
 *               ip_cidr: { type: string, description: "CIDR notation IP range" }
 *               label: { type: string }
 *               role_scope:
 *                 type: array
 *                 items: { type: string }
 *                 description: "Roles this entry applies to, defaults to [STORE_OWNER, MANAGER, SUPER_ADMIN]"
 *               is_active: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Allowlist entry created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/', hasPermission('rbac:write'), ipAllowlistController.create);

/**
 * @swagger
 * /admin/ip-allowlist/{id}:
 *   put:
 *     summary: Update an IP allowlist entry
 *     tags: [Admin IP Allowlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ip_cidr: { type: string, description: "CIDR notation IP range" }
 *               label: { type: string }
 *               role_scope:
 *                 type: array
 *                 items: { type: string }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Allowlist entry updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put('/:id', hasPermission('rbac:write'), ipAllowlistController.update);

/**
 * @swagger
 * /admin/ip-allowlist/{id}:
 *   delete:
 *     summary: Remove an IP allowlist entry
 *     tags: [Admin IP Allowlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Allowlist entry deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/:id', hasPermission('rbac:write'), ipAllowlistController.delete);

module.exports = router;
