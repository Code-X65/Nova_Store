const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/report.controller');
const { protect } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const Joi = require('joi');

const reportSchema = Joi.object({
  reviewId: Joi.string().guid().required(),
  reason: Joi.string().max(100).required(),
  description: Joi.string().max(500).optional().allow('')
});

/**
 * @swagger
 * tags:
 *   name: ReviewReports
 *   description: Review reporting & moderation queue
 */

/**
 * @swagger
 * /review-reports:
 *   post:
 *     summary: Report an inappropriate review
 *     tags: [ReviewReports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewId, reason]
 *             properties:
 *               reviewId:    { type: string, format: uuid }
 *               reason:      { type: string }
 *               description: { type: string }
 *     responses:
 *       201: { description: Report submitted }
 *       400: { description: Already reported or invalid }
 */
router.post('/', protect, validate({ body: reportSchema }), reviewController.createReport);

/**
 * @swagger
 * /review-reports:
 *   get:
 *     summary: Get user-submitted reports
 *     tags: [ReviewReports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: User's reports }
 */
router.get('/me', protect, reviewController.getMyReports);

module.exports = router;
