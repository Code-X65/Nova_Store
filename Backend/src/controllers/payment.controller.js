const PaymentService = require('../services/payment.service');

class PaymentController {
  async initializePaystack(req, res, next) {
    try {
      const { email, amount, checkoutSessionId } = req.body;
      const userId = req.user.id;
      const result = await PaymentService.initializePaystack(userId, email, amount, checkoutSessionId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyPaystack(req, res, next) {
    try {
      const { reference } = req.params;
      const result = await PaymentService.verifyPaystack(reference);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async handleStripeWebhook(req, res, next) {
    try {
      const signature = req.headers['stripe-signature'];
      // req.body is a raw buffer here due to express.raw() in routes
      await PaymentService.handleWebhook('stripe', req.body, signature);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Stripe Webhook Error:', error);
      res.status(400).send(error.message);
    }
  }

  async handlePaystackWebhook(req, res, next) {
    try {
      const signature = req.headers['x-paystack-signature'];
      await PaymentService.handleWebhook('paystack', req.body, signature);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Paystack Webhook Error:', error);
      res.status(400).send(error.message);
    }
  }
}

module.exports = new PaymentController();
