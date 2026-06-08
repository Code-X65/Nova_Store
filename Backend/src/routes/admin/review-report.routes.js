const express = require('express');
const router = express.Router();
const reviewAdminController = require('../../controllers/admin/review.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const validate = require('../../middlewares/validate.middleware');
const Joi = require('joi');

const resolveSchema = Joi.object({
  status: Joi.string().valid('resolved', 'dismissed').required(),
  adminNote: Joi.string().max(500).optional().allow('')
});

const listSchema = Joi.object({
  status: Joi.string().valid('pending', 'resolved', 'dismissed').optional(),
  reviewId: Joi.string().guid().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional()
});

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Review Reports
 *   description: Review reporting queue for admins
 */

/**
 * @swagger
 * /admin/review-reports:
 *   get:
 *     summary: Paginated list of review reports (filters: status, reviewId)
 *     tags: [Admin Review Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query name: status schema: { type: string, enum: [pending,resolved,dismissed] }
 *       - in: query name: page    schema: { type: integer, default: 1 }
 *       - in: query name: limit   schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated report queue }
 */
router.get('/', validate({ query: listSchema }), reviewAdminController.getReports);

/**
 * @swagger
 * /admin/review-reports/{id}:
 *   patch:
 *     summary: Resolve or dismiss a report
 *     tags: [Admin Review Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:    { type: string, enum: [resolved, dismissed] }
 *               adminNote: { type: string }
 *     responses:
 *       200: { description: Report resolved }
 */
router.patch('/:id', validate({ body: resolveSchema }), reviewAdminController.resolveReport);

/**
 * @swagger
 * /admin/review-reports/summary:
 *   get:
 *     summary: Aggregated report counts for admin dashboard
 *     tags: [Admin Review Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Counts by status and by review }
 */
router.get('/summary', reviewAdminController.getReportSummary);

module.exports = router;
