const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment gateway integrations
 */

/**
 * @swagger
 * /payments/paystack/initialize:
 *   post:
 *     summary: Initialize Paystack payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
router.post('/paystack/initialize', protect, paymentController.initializePaystack);

/**
 * @swagger
 * /payments/paystack/verify/{reference}:
 *   get:
 *     summary: Verify Paystack payment
 *     tags: [Payments]
 */
router.get('/paystack/verify/:reference', paymentController.verifyPaystack);

/**
 * @swagger
 * /payments/webhook/stripe:
 *   post:
 *     summary: Handle Stripe webhooks (raw body required for signature verification)
 *     tags: [Payments]
 */
// IMPORTANT: Stripe webhook MUST use express.raw() to preserve the raw buffer for HMAC signature verification.
// Do NOT use express.json() here — it destroys the raw bytes needed by stripe.webhooks.constructEvent().
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

/**
 * @swagger
 * /payments/webhook/paystack:
 *   post:
 *     summary: Handle Paystack webhooks
 *     tags: [Payments]
 */
router.post('/webhook/paystack', express.json(), paymentController.handlePaystackWebhook);

module.exports = router;
