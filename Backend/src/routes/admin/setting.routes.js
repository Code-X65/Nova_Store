const express = require('express');
const router = express.Router();
const settingAdminController = require('../../controllers/admin/setting.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Settings
 *   description: Global system configuration and settings
 */

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: Get all settings (optional group filter)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: group
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of all settings
 */
router.get('/', hasPermission('settings:read'), settingAdminController.getAllSettings);

/**
 * @swagger
 * /admin/settings/bulk:
 *   patch:
 *     summary: Bulk update settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Map of setting keys to their new values
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.patch('/bulk', hasPermission('settings:write'), settingAdminController.bulkUpdate);

/**
 * @swagger
 * /admin/settings/test-email:
 *   post:
 *     summary: Send a test email to verify configuration
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipient: { type: string }
 *     responses:
 *       200:
 *         description: Test email sent
 */
router.post('/test-email', hasPermission('settings:write'), settingAdminController.testEmail);

/**
 * @swagger
 * /admin/settings/{key}:
 *   get:
 *     summary: Get single setting by key
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Setting details
 *   put:
 *     summary: Update single setting by key
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value: { description: "The new value (type varies)" }
 *               changeReason: { type: string }
 *     responses:
 *       200:
 *         description: Updated setting
 */
router.get('/:key', hasPermission('settings:read'), settingAdminController.getSettingByKey);
router.put('/:key', hasPermission('settings:write'), settingAdminController.updateSetting);

/**
 * @swagger
 * /admin/settings/history/{key}:
 *   get:
 *     summary: Get setting change history
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Setting history
 */
router.get('/history/:key', hasPermission('settings:read'), settingAdminController.getSettingHistory);

module.exports = router;
