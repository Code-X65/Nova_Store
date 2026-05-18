const OrderModel = require('../models/order.model');
const PaymentModel = require('../models/payment.model');
const InventoryService = require('./inventory.service');
const CartService = require('./cart.service');
const InventoryReservationService = require('./inventory-reservation.service');
const AuditService = require('./audit.service');
const crypto = require('crypto');
const Stripe = require('stripe');
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

class PaymentService {
  async initializePaystack(userId, email, amount, checkoutSessionId) {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          amount: Math.round(amount * 100), // convert to kobo
          metadata: { checkoutSessionId, userId }
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to initialize Paystack payment');
      }

      const { data } = result;
      
      return {
        authorizationUrl: data.authorization_url,
        reference: data.reference
      };
    } catch (error) {
      console.error('Paystack Init Error:', error.message);
      throw error;
    }
  }

  async verifyPaystack(reference) {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to verify Paystack payment');
      }

      const { data } = result;
      if (data.status === 'success') {
        await this.handleSuccessfulPayment(data.reference, 'paystack', data);
      }
      return data;
    } catch (error) {
      throw error;
    }
  }

  async handleWebhook(provider, payload, signature) {
    // 1. Verify Signature
    if (!this.verifySignature(provider, payload, signature)) {
      throw new Error('Invalid signature');
    }

    // 2. Process based on provider
    if (provider === 'paystack') {
      const { event, data } = payload;
      if (event === 'charge.success') {
        await this.handleSuccessfulPayment(data.reference, 'paystack', data);
      }
    } else if (provider === 'stripe') {
      const { type, data } = payload;
      if (type === 'checkout.session.completed') {
        await this.handleSuccessfulPayment(data.object.id, 'stripe', data.object);
      }
    }
    
    return { success: true };
  }

  verifySignature(provider, payload, signature) {
    if (provider === 'paystack') {
      const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                         .update(JSON.stringify(payload))
                         .digest('hex');
      return hash === signature;
    }

    if (provider === 'stripe') {
      if (!signature) return false;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is not set; cannot verify Stripe signature');
        return false;
      }
      try {
        stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
        return true;
      } catch (err) {
        console.error('Stripe signature verification failed:', err.message);
        return false;
      }
    }

    return false;
  }

  async handleSuccessfulPayment(reference, provider, rawResponse) {
    // 1. Find existing payment or order
    const payment = await PaymentModel.findByReference(reference);
    
    let orderId;
    if (payment) {
      if (payment.status === 'success') return; // Already processed
      orderId = payment.order_id;
      await PaymentModel.updateStatus(payment.id, 'success', rawResponse);
    } else {
      // Find order by metadata or reference if linked
      // For simplicity, let's assume we can find the order
      // This part needs careful mapping
    }

    // 2. Update Order Status
    if (orderId) {
      const order = await OrderModel.findById(orderId);
      if (order.payment_status === 'paid') return;

      await OrderModel.updateStatus(orderId, 'processing', 'paid');

      // 3. Commit reserved stock → real stock reduction
      try {
        await InventoryReservationService.commitReservedStock(orderId);
      } catch (commitErr) {
        console.error(`[Payment] commitReservedStock warning for order ${orderId}:`, commitErr.message);
      }

      // 4. Audit log: payment confirmed
      AuditService.log(null, 'payment.succeeded', 'order', orderId, null, {
        reference, provider, total: order.total_amount, orderNumber: order.order_number
      });

      // 5. Clear Cart
      await CartService.clearCart(order.user_id, null);

      // Record Coupon Usage
      if (order.coupon_id) {
        try {
          const CouponModel = require('../models/coupon.model');
          await CouponModel.incrementUsage(order.coupon_id);
          if (order.user_id) {
            await CouponModel.logUserUsage(order.user_id, order.coupon_id);
          }
        } catch (couponErr) {
          console.error(`Failed to record coupon usage for order ${orderId}:`, couponErr.message);
        }
      }

      // Send Confirmation Email (TODO)
    }
  }

  /**
   * Release inventory reservations when a checkout session is abandoned
   * or a payment is explicitly failed. Exposed so routes / controllers
   * can call it when the frontend reports a failed payment attempt.
   */
  async releaseReservations(checkoutSessionId) {
    try {
      await InventoryReservationService.releaseSessionReservations(checkoutSessionId);
    } catch (err) {
      console.error(`[Payment] Failed to release reservations for session ${checkoutSessionId}:`, err.message);
    }
  }
}

module.exports = new PaymentService();
