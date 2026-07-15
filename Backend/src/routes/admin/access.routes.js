const express = require('express');
const router = express.Router();

const { hasPermission } = require('../../middlewares/permission.middleware');
const accessController = require('../../controllers/admin/access.controller');
const sseGateway = require('../../realtime/sse.gateway');

/**
 * @swagger
 * tags:
 *   - name: Admin Access
 *     description: Real-time admin event stream and admin account lockout/removal
 */

/**
 * Real-time event stream (SSE). Authenticated via the global requireAdmin
 * middleware applied to /api/v1/admin. CSRF is exempt (GET).
 */
/**
 * @swagger
 * /admin/stream:
 *   get:
 *     summary: Subscribe to the real-time admin event stream (Server-Sent Events)
 *     tags: [Admin Access]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE stream opened
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/stream', sseGateway.registerSse);

/**
 * Account lifecycle — Super Admin (STORE_OWNER) only.
 */
/**
 * @swagger
 * /admin/access/{id}/lock:
 *   post:
 *     summary: Lock an admin account and terminate all its active sessions
 *     tags: [Admin Access]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Account locked
 *       400:
 *         description: Cannot lock own account
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Admin user not found
 */
router.post('/access/:id/lock',   hasPermission('staff:write'), accessController.lock);

/**
 * @swagger
 * /admin/access/{id}/unlock:
 *   post:
 *     summary: Unlock an admin account
 *     tags: [Admin Access]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Account unlocked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Admin user not found
 */
router.post('/access/:id/unlock', hasPermission('staff:write'), accessController.unlock);

/**
 * @swagger
 * /admin/access/{id}/remove:
 *   delete:
 *     summary: Permanently remove an admin account (hard delete, with forensic snapshot)
 *     tags: [Admin Access]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Administrator profile permanently removed
 *       400:
 *         description: Cannot remove own account
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Admin user not found
 */
router.delete('/access/:id/remove', hasPermission('staff:write'), accessController.remove);

module.exports = router;
