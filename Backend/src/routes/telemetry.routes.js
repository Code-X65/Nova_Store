const express = require('express');
const telemetryController = require('../controllers/telemetry.controller');
const validate = require('../middlewares/validate.middleware');
const telemetryValidator = require('../validators/telemetry.validator');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Telemetry
 *   description: Analytics and telemetry tracking for searches and views
 */

/**
 * @swagger
 * /analytics/track-search:
 *   post:
 *     summary: Track user search query
 *     tags: [Telemetry]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [search_query]
 *             properties:
 *               search_query: { type: string, example: "gaming laptop" }
 */
router.post('/track-search', validate(telemetryValidator.trackSearch), telemetryController.trackSearch);

/**
 * @swagger
 * /analytics/track-view:
 *   post:
 *     summary: Track product detail view session
 *     tags: [Telemetry]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id]
 *             properties:
 *               product_id: { type: string, format: uuid }
 *               view_duration: { type: integer, example: 45 }
 */
router.post('/track-view', validate(telemetryValidator.trackView), telemetryController.trackView);

module.exports = router;
