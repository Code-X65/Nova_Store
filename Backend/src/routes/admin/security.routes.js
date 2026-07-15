const express = require('express');
const router = express.Router();
const securityController = require('../../controllers/admin/security.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Security
 *   description: 2FA and security settings for admin accounts
 */

/**
 * @swagger
 * /admin/security/2fa/status:
 *   get:
 *     summary: Get 2FA status for the current admin
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/2fa/status', hasPermission('settings:read'), securityController.get2faStatus);

/**
 * @swagger
 * /admin/security/2fa/enable:
 *   post:
 *     summary: Begin enabling 2FA (generates secret/QR setup data)
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup data returned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/2fa/enable', hasPermission('settings:write'), securityController.enable2fa);

/**
 * @swagger
 * /admin/security/2fa/verify:
 *   post:
 *     summary: Verify a 2FA TOTP token to complete setup or confirm identity
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: "6-digit TOTP code" }
 *     responses:
 *       200:
 *         description: Token verified
 *       400:
 *         description: Token is required
 *       401:
 *         description: Invalid token / Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/2fa/verify', hasPermission('settings:write'), securityController.verify2fa);

/**
 * @swagger
 * /admin/security/2fa/disable:
 *   post:
 *     summary: Disable 2FA for the current admin
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: 2FA disabled
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.post('/2fa/disable', hasPermission('settings:write'), securityController.disable2fa);

/**
 * @swagger
 * /admin/security/2fa/recovery:
 *   post:
 *     summary: Use a 2FA recovery code to authenticate
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, description: "One-time recovery code" }
 *     responses:
 *       200:
 *         description: Recovery code accepted
 *       400:
 *         description: Recovery code is required
 *       401:
 *         description: Invalid code / Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/2fa/recovery', hasPermission('settings:write'), securityController.useRecoveryCode);

module.exports = router;
