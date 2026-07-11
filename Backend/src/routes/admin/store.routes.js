const express = require('express');
const router = express.Router();
const storeAdminController = require('../../controllers/admin/store.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Store
 *   description: Store profile and settings management
 */

/**
 * @swagger
 * /admin/store:
 *   get:
 *     summary: Get store profile and settings
 *     tags: [Admin Store]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Store profile details
 */
router.get('/', storeAdminController.getStoreProfile);

/**
 * @swagger
 * /admin/store:
 *   put:
 *     summary: Update core store profile
 *     tags: [Admin Store]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated profile
 */
router.put('/', hasPermission('settings:write'), storeAdminController.updateStoreProfile);

/**
 * @swagger
 * /admin/store/settings:
 *   patch:
 *     summary: Bulk update store settings
 *     tags: [Admin Store]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key: { type: string }
 *                     value: {}
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.patch('/settings', hasPermission('settings:write'), storeAdminController.updateStoreSettings);

module.exports = router;
