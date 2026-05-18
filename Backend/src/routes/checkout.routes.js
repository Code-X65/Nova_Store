const express = require('express');
const checkoutController = require('../controllers/checkout.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Checkout
 *   description: Order checkout and validation
 */

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    return protect(req, res, next);
  }
  next();
};

/**
 * @swagger
 * /checkout/validate:
 *   post:
 *     summary: Validate cart before checkout
 *     tags: [Checkout]
 */
router.post('/validate', optionalAuth, checkoutController.validate);

/**
 * @swagger
 * /checkout/shipping:
 *   post:
 *     summary: Calculate shipping costs
 *     tags: [Checkout]
 */
router.post('/shipping', optionalAuth, checkoutController.calculateShipping);

/**
 * @swagger
 * /checkout/coupon:
 *   post:
 *     summary: Apply coupon to checkout
 *     tags: [Checkout]
 */
router.post('/coupon', optionalAuth, checkoutController.applyCoupon);

/**
 * @swagger
 * /checkout/session:
 *   post:
 *     summary: Create checkout session and order
 *     tags: [Checkout]
 */
router.post('/session', optionalAuth, checkoutController.createSession);

/**
 * @swagger
 * /checkout/session/expire:
 *   post:
 *     summary: Expire a checkout session and release reserved stock
 *     tags: [Checkout]
 *     description: |
 *       Called by the frontend when a checkout session is abandoned or timed out
 *       (e.g. customer closes the payment page without completing the transaction).
 *       Frees up any inventory that was held during this session so other customers
 *       can purchase it.
 */
router.post('/session/expire', checkoutController.expireSession);

module.exports = router;
