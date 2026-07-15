const express = require('express');
const userRoleController = require('../controllers/user-role.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');

const router = express.Router();

router.use(protect);
router.use(hasPermission('role:manage'));

/**
 * @swagger
 * tags:
 *   - name: User Roles
 *     description: Assigning and revoking roles for a user
 */

/**
 * @swagger
 * /user-routes/{userId}:
 *   get:
 *     summary: Get the roles assigned to a user
 *     tags: [User Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User's roles
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/:userId', userRoleController.getUserRoles);

/**
 * @swagger
 * /user-routes/{userId}:
 *   post:
 *     summary: Assign one or more roles to a user
 *     tags: [User Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Roles assigned
 *       400:
 *         description: Validation error - roleIds must be a non-empty array
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - cannot modify own roles or roles of a Manager/Store Owner
 */
router.post('/:userId', userRoleController.assignRole);

/**
 * @swagger
 * /user-routes/{userId}/{roleId}:
 *   delete:
 *     summary: Revoke a role from a user
 *     tags: [User Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Role revoked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - cannot modify own roles or roles of a Manager/Store Owner
 */
router.delete('/:userId/:roleId', userRoleController.revokeRole);

module.exports = router;
