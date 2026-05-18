const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/auth.middleware');
const reviewController = require('../controllers/review.controller');
const reportController = require('../controllers/report.controller');

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Product reviews + user reporting
 */

/**
 * @swagger
 * /api/v1/reviews/product/{productId}:
 *   get:
 *     summary: Get reviews for a product (public, approved only, sorted newest→helpful)
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [newest,rating,helpful]
 *     responses:
 *       200:
 *         description: Paginated list of product reviews
 */

/**
 * Required auth for all mutating review actions
 */
router.use(protect);

/**
 * @swagger
 * /api/v1/reviews:
 *   post:
 *     summary: Add a product review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - rating
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *               orderId:
 *                 type: string
 *                 format: uuid
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review created
 */
router.post('/', reviewController.addReview);

/**
 * @swagger
 * /api/v1/reports:
 *   post:
 *     summary: Flag a review as inappropriate
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reviewId
 *               - reason
 *             properties:
 *               reviewId:
 *                 type: string
 *                 format: uuid
 *               reason:
 *                 type: string
 *                 enum: [spam,inappropriate,fake,offensive,other]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report submitted
 */
router.post('/reports', reportController.createReport);

/**
 * @swagger
 * /api/v1/reports/me:
 *   get:
 *     summary: List current user's submitted reports
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: User's reports
 */
router.get('/reports/me', reportController.getMyReports);

/**
 * @swagger
 * /api/v1/reviews/{id}:
 *   put:
 *     summary: Update a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review updated
 *       404:
 *         description: Review not found
 *       403:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Review deleted
 *       404:
 *         description: Review not found
 *       403:
 *         description: Unauthorized
 */
router.put('/:id', reviewController.updateReview);
router.delete('/:id', reviewController.deleteReview);

/**
 * @swagger
 * /api/v1/reviews/{id}/helpful:
 *   post:
 *     summary: Vote on review helpfulness
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: body
 *         name: isHelpful
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Vote recorded successfully
 *       404:
 *         description: Review not found
 */
router.post('/:id/helpful', reviewController.voteHelpful);

module.exports = router;
