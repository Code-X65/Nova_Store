const express = require('express');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const adminSessionController = require('../../controllers/admin/session.controller');

const router = express.Router();

// All routes require authentication
router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Sessions
 *   description: Admin session management
 */

/**
 * @swagger
 * /admin/sessions:
 *   get:
 *     summary: Get active sessions for current admin user
 *     tags: [Admin Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', adminSessionController.getActiveSessions);

/**
 * @swagger
 * /admin/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific session
 *     tags: [Admin Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found or unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/:sessionId', adminSessionController.revokeSession);

/**
 * @swagger
 * /admin/sessions:
 *   delete:
 *     summary: Revoke all admin sessions for current user (security feature)
 *     tags: [Admin Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All admin sessions revoked successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.delete('/', adminSessionController.revokeAllSessions);

module.exports = router;