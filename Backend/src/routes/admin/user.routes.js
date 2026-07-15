const express = require('express');
const { hasPermission } = require('../../middlewares/permission.middleware');
const authController = require('../../controllers/auth.controller');

const router = express.Router();

router.use(hasPermission('user:read'));

/**
 * @swagger
 * tags:
 *   - name: Admin Users
 *     description: Customer/user account management for admins
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List users (paginated, searchable)
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', authController.adminListUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   patch:
 *     summary: Update a user's active status and/or role
 *     tags: [Admin Users]
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
 *               is_active: { type: boolean }
 *               role: { type: string }
 *     responses:
 *       200:
 *         description: User updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.patch('/:id', hasPermission('user:write'), authController.adminUpdateUserStatus);

module.exports = router;
