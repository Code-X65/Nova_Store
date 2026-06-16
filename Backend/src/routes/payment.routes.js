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
 * /payments/stripe/initialize:
 *   post:
 *     summary: Initialize Stripe Checkout Session
 *     description: |
 *       Creates a Stripe Checkout Session and a pending payment record.
 *       Returns a `url` to redirect the customer to Stripe's hosted payment page.
 *       The `checkoutSessionId` and `orderId` from `POST /checkout` are required.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, amount, checkoutSessionId, orderId]
 *             properties:
 *               email:     { type: string, format: email }
 *               amount:    { type: number, example: 15000 }
 *               checkoutSessionId: { type: string, format: uuid }
 *               orderId:   { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stripe session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId: { type: string }
 *                     url:       { type: string }
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/stripe/initialize', protect, paymentController.initializeStripe);

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
