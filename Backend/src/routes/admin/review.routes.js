const express = require('express');
const router = express.Router();
const reviewAdminController = require('../../controllers/admin/review.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const joi = require('joi');

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};

const moderateSchema = joi.object({
  status: joi.string().valid('approved', 'hidden', 'pending').required()
});

const bulkSchema = joi.object({
  reviewIds: joi.array().items(joi.string().uuid()).min(1).required(),
  action: joi.string().valid('approve', 'hide', 'delete').required()
});

router.use(requireAdmin);
router.use(hasPermission('review:write'));

/**
 * @swagger
 * tags:
 *   name: Admin Reviews
 *   description: Admin moderation of product reviews
 */

/**
 * @swagger
 * /admin/reviews:
 *   get:
 *     summary: List all reviews globally (with filters)
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reviews
 */
router.get('/', reviewAdminController.getAllReviews);

/**
 * @swagger
 * /admin/reviews/{id}:
 *   patch:
 *     summary: Moderate a review (approve/hide/pending)
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Moderated review
 *   delete:
 *     summary: Permanently delete a review
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review deleted
 */
router.patch('/:id', validateRequest(moderateSchema), reviewAdminController.moderateReview);
router.delete('/:id', reviewAdminController.deleteReview);

/**
 * @swagger
 * /admin/reviews/bulk-action:
 *   post:
 *     summary: Perform bulk moderation actions
 *     tags: [Admin Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviewIds: { type: array, items: { type: string, format: uuid } }
 *               action: { type: string, enum: [approve, hide, delete] }
 *     responses:
 *       200:
 *         description: Bulk action executed
 */
router.post('/bulk-action', validateRequest(bulkSchema), reviewAdminController.bulkAction);

module.exports = router;
