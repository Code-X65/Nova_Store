const express = require('express');
const router = express.Router();
const acceptInviteController = require('../../controllers/public/accept-invite.controller');
const { authLimiter } = require('../../middlewares/rate-limit.middleware');

/**
 * @swagger
 * tags:
 *   name: Admin Onboarding
 *   description: Public endpoints for accepting administrator invitations
 */

/**
 * @swagger
 * /accept-invite/{token}:
 *   get:
 *     summary: Retrieve invitation metadata for verification (Public)
 *     tags: [Admin Onboarding]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: 64-character hex invitation token
 *     responses:
 *       200:
 *         description: Secure metadata (email, roleName, expiresAt)
 *       400:
 *         description: Invalid or expired token
 */
router.get('/:token', authLimiter, acceptInviteController.getInviteInfo.bind(acceptInviteController));

/**
 * @swagger
 * /accept-invite/{token}:
 *   post:
 *     summary: Complete admin onboarding and create user account (Public)
 *     tags: [Admin Onboarding]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: 64-character hex invitation token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password, firstName, lastName]
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecureP@ss123!
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Smith
 *     responses:
 *       201:
 *         description: Account successfully created and invitation accepted
 *       400:
 *         description: Validation error or expired token
 *       409:
 *         description: Conflict (Email already registered)
 */
router.post('/:token', authLimiter, acceptInviteController.acceptInvite.bind(acceptInviteController));

module.exports = router;

