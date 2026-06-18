const express = require('express');
const router = express.Router();
const requireAdmin = require('../../middlewares/require-admin.middleware');
const requireSuperAdmin = require('../../middlewares/require-super-admin.middleware');
const adminController = require('../../controllers/admin/admin-management.controller');

/**
 * @swagger
 * tags:
 *   name: Admin Management
 *   description: SuperAdmin-only administrative operations and general admin utilities
 */

/**
 * @swagger
 * /admin/my-permissions:
 *   get:
 *     summary: Retrieve roles and permissions for the current admin actor
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
router.get('/my-permissions', requireAdmin, adminController.getMyPermissions.bind(adminController));

/**
 * @swagger
 * /admin:
 *   get:
 *     summary: List all admin users (SuperAdmin only)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role name
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Partial name/email search
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of admin users
 *       403:
 *         description: Forbidden (Only SUPER_ADMIN)
 */
router.get('/', requireSuperAdmin, adminController.listAdmins.bind(adminController));

/**
 * @swagger
 * /admin/{id}:
 *   get:
 *     summary: Retrieve details of a specific admin user (SuperAdmin only)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Admin user details
 *       404:
 *         description: Admin user not found
 */
router.get('/:id', requireSuperAdmin, adminController.getAdmin.bind(adminController));

/**
 * @swagger
 * /admin/{id}/roles:
 *   patch:
 *     summary: Update roles of a specific admin user (SuperAdmin only)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleIds]
 *             properties:
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Roles updated successfully
 *       400:
 *         description: Cannot modify own roles or invalid input
 *       404:
 *         description: Admin user not found
 */
router.patch('/:id/roles', requireSuperAdmin, adminController.updateAdminRoles.bind(adminController));

/**
 * @swagger
 * /admin/{id}/permissions:
 *   patch:
 *     summary: Update granular extra permissions for a specific admin user (SuperAdmin only)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Extra permissions updated successfully
 *       400:
 *         description: Validation error or unknown permission slugs
 *       404:
 *         description: Admin user not found
 */
router.patch('/:id/permissions', requireSuperAdmin, adminController.updateAdminPermissions.bind(adminController));

/**
 * @swagger
 * /admin/{id}:
 *   delete:
 *     summary: Revoke access for a specific admin user (SuperAdmin only)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Access successfully revoked
 *       400:
 *         description: Cannot revoke own access
 *       404:
 *         description: Admin user not found
 */
router.delete('/:id', requireSuperAdmin, adminController.revokeAdminAccess.bind(adminController));

/**
 * @swagger
 * /admin/{id}/permissions:
 *   get:
 *     summary: Retrieve effective roles and permissions for a specific admin (SuperAdmin only)
 *     tags: [Admin Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Effective roles and permissions
 *       404:
 *         description: Admin user not found
 */
router.get('/:id/permissions', requireSuperAdmin, adminController.getAdminPermissions.bind(adminController));

module.exports = router;
