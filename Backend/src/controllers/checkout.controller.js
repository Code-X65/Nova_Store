const CheckoutService = require('../services/checkout.service');
const CouponService = require('../services/coupon.service');
const AuditService = require('../services/audit.service');
const CartService = require('../services/cart.service');
const shippingService = require('../services/shipping.service');

class CheckoutController {
  async validate(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'];
      const { cartId } = req.body;

      const result = await CheckoutService.validateCheckout(userId, sessionId, cartId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

   async calculateShipping(req, res, next) {
     try {
       const { cartId, address } = req.body;
       const userId = req.user ? req.user.id : null;
       const sessionId = req.headers['x-session-id'];
       
       // Get cart to calculate subtotal for shipping options
       const cart = await CartService.getOrCreateCart(userId, sessionId, cartId);
       
       // Use the shipping service to calculate real shipping options
       const options = await shippingService.calculateShippingOptions(address, cart.subtotal);
       
       res.status(200).json({ success: true, data: { shippingOptions: options } });
     } catch (error) {
       next(error);
     }
   }

  async applyCoupon(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const { cartId, code } = req.body;
      const result = await CouponService.validateAndApplyCoupon(userId, cartId, code);
      AuditService.log(req, 'coupon.applied', 'coupon', result.coupon.id, null, { code });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async createSession(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'];
      const result = await CheckoutService.createCheckoutSession(userId, sessionId, req.body);
      AuditService.log(req, 'checkout.session_created', 'order', result.checkoutSession.orderId, null, { total: result.checkoutSession.total });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /checkout/session/expire
   * Called by the frontend when a checkout session is abandoned.
   * Releases inventory reservations tied to the session.
   */
  async expireSession(req, res, next) {
    try {
      const sessionId = req.headers['x-session-id'];
      if (!sessionId) {
        const error = new Error('Session ID is required');
        error.statusCode = 400;
        throw error;
      }
      await CheckoutService.expireCheckoutSession(sessionId);
      res.status(200).json({ success: true, message: 'Checkout session expired and inventory released' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CheckoutController();
