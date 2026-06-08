const express = require('express');
const router = express.Router();
const adminAuthController = require('../../controllers/admin/auth.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');

/**
 * @swagger
 * tags:
 *   name: Admin Auth
 *   description: Admin-only authentication (email + password, session-cookie based)
 */

/**
 * @swagger
 * /api/v1/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful, session cookie set
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post('/login', adminAuthController.login);

/**
 * @swagger
 * /api/v1/admin/logout:
 *   post:
 *     summary: Admin logout
 *     tags: [Admin Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully, session cookie cleared
 */
router.post('/logout', adminAuthController.logout);

/**
 * @swagger
 * /api/v1/admin/verify:
 *   get:
 *     summary: Verify active admin session
 *     tags: [Admin Auth]
 *     responses:
 *       200:
 *         description: Active session — returns admin email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *       401:
 *         description: No active session
 */
router.get('/verify', requireAdmin, adminAuthController.verify);

module.exports = router;
