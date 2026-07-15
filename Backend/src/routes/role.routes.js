const express = require('express');
const roleController = require('../controllers/role.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');
const requireAdmin = require('../middlewares/require-admin.middleware');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * tags:
 *   - name: Roles
 *     description: Role and role-permission management
 */

// GET routes require admin access so any staff/manager can list roles (e.g. for invitations)
/**
 * @swagger
 * /roles:
 *   get:
 *     summary: List all roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', requireAdmin, roleController.getAllRoles);

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Get a role by ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Role details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Role not found
 */
router.get('/:id', requireAdmin, roleController.getRoleById);

// Write routes require role:manage permission
/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Create a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               display_name: { type: string }
 *               description: { type: string }
 *               color_code: { type: string }
 *               permissionIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Role created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - cannot grant permissions you do not hold yourself
 */
router.post('/', hasPermission('role:manage'), roleController.createRole);

/**
 * @swagger
 * /roles/{id}:
 *   patch:
 *     summary: Update a role
 *     tags: [Roles]
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
 *               name: { type: string }
 *               display_name: { type: string }
 *               description: { type: string }
 *               color_code: { type: string }
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Role not found
 */
router.patch('/:id', hasPermission('role:manage'), roleController.updateRole);

/**
 * @swagger
 * /roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Role deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Role not found
 */
router.delete('/:id', hasPermission('role:manage'), roleController.deleteRole);

/**
 * @swagger
 * /roles/{id}/permissions:
 *   post:
 *     summary: Assign permissions to a role (replaces the role's permission set)
 *     tags: [Roles]
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
 *             required: [permissionIds]
 *             properties:
 *               permissionIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Permissions assigned
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - cannot grant permissions you do not hold yourself
 *       404:
 *         description: Role not found
 */
router.post('/:id/permissions', hasPermission('role:manage'), roleController.assignPermissions);

module.exports = router;
