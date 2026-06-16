const express = require('express');
const router = express.Router();
const couponController = require('../controllers/coupon.controller');
const { protect, optionalAuth } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Coupons
 *   description: Customer coupon endpoints
 */

/**
 * @swagger
 * /coupons/available:
 *   get:
 *     summary: Get all available coupons for the current user
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available coupons
 */
router.get('/available', protect, couponController.getAvailableCoupons);

/**
 * @swagger
 * /coupons/my:
 *   get:
 *     summary: Get coupon usage history for the current user
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coupon history
 */
router.get('/my', protect, couponController.getMyCoupons);

/**
 * @swagger
 * /coupons/validate:
 *   post:
 *     summary: Validate a coupon code before checkout
 *     tags: [Coupons]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string }
 *               cartTotal: { type: number }
 *     responses:
 *       200:
 *         description: Coupon validation result
 */
router.post('/validate', optionalAuth, couponController.validateCoupon);

module.exports = router;
