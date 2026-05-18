const express = require('express');
const router = express.Router();
const settingPublicController = require('../../controllers/public/setting.public.controller');

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: Public store configuration endpoints
 */

/**
 * @swagger
 * /api/v1/settings/public:
 *   get:
 *     summary: Get all public settings (e.g. store info, currency)
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Grouped public settings
 */
router.get('/public', settingPublicController.getPublicSettings);

module.exports = router;
