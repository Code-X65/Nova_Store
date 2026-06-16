const OrderModel = require('../models/order.model');
const PaymentModel = require('../models/payment.model');
const InventoryService = require('./inventory.service');
const CartService = require('./cart.service');
const CouponService = require('./coupon.service');
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
      // No pre-existing payments row — typical for Stripe webhooks when the frontend
      // redirects directly to Stripe Checkout without calling our initialize endpoint.
      // Retrieve the Stripe session to extract the internal checkoutSessionId stored
      // in metadata, then locate the order and create the payments record.
      if (provider === 'stripe') {
        try {
          const stripeSession = await stripeClient.checkout.sessions.retrieve(reference);
          const internalSessionId = stripeSession?.metadata?.checkoutSessionId;

          if (!internalSessionId) {
            console.error(`[Payment] Stripe session ${reference} has no checkoutSessionId metadata.`);
            return;
          }

          const matchedOrder = await OrderModel.findByCheckoutSessionId(internalSessionId);
          if (!matchedOrder) {
            console.error(`[Payment] No order found for checkoutSessionId ${internalSessionId}.`);
            return;
          }

          orderId = matchedOrder.id;

          // Persist the payments row so future webhook retries hit the fast path above
          await PaymentModel.create({
            order_id: orderId,
            reference,
            provider: 'stripe',
            amount: matchedOrder.total_amount,
            currency: 'NGN',
            status: 'success',
            raw_response: rawResponse,
          });
        } catch (lookupErr) {
          console.error('[Payment] Failed to resolve Stripe order from webhook:', lookupErr.message);
          return;
        }
      } else {
        console.error(`[Payment] No payment record found for reference ${reference} (${provider}).`);
        return;
      }
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

      // Record Coupon Usage — delegated to CouponService (single source of truth)
      if (order.coupon_id) {
        try {
          await CouponService.recordCouponUsage(order.user_id, order.coupon_id);
        } catch (couponErr) {
          console.error(`Failed to record coupon usage for order ${orderId}:`, couponErr.message);
        }
      }

      // Send Confirmation Email (TODO)
    }
  }

  /**
   * Initialize a Stripe Checkout Session.
   * Creates a pending `payments` row keyed on the Stripe session ID so that
   * the incoming webhook can be resolved idempotently via PaymentModel.findByReference.
   *
   * @param {string}  userId            - Authenticated user's ID
   * @param {string}  email             - Customer email for the Stripe session
   * @param {number}  amount            - Total in major currency units (e.g. NGN)
   * @param {string}  checkoutSessionId - Internal UUID from createCheckoutSession
   * @param {string}  orderId           - Order ID to associate the payment with
   * @returns {{ sessionId: string, url: string }}
   */
  async initializeStripe(userId, email, amount, checkoutSessionId, orderId) {
    try {
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: email,
        line_items: [{
          price_data: {
            currency: (process.env.CURRENCY || 'ngn').toLowerCase(),
            product_data: { name: 'Nova Store Order' },
            unit_amount: Math.round(amount * 100), // Stripe expects minor units
          },
          quantity: 1,
        }],
        // Embed our internal IDs in metadata so the webhook can resolve the order
        // even when no pending payments row was created before the session completed.
        metadata: { checkoutSessionId, orderId, userId: String(userId) },
        success_url: `${process.env.CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${process.env.CLIENT_URL}/checkout/cancel`,
      });

      // Persist a pending payment row so the webhook lookup (findByReference) hits
      // the fast idempotent path instead of the slower metadata-resolve fallback.
      await PaymentModel.create({
        order_id: orderId,
        reference: session.id,
        provider: 'stripe',
        amount,
        currency: (process.env.CURRENCY || 'NGN').toUpperCase(),
        status: 'pending',
      });

      return { sessionId: session.id, url: session.url };
    } catch (error) {
      console.error('Stripe Init Error:', error.message);
      throw error;
    }
  }

  /**
   * Refund a successful payment via the gateway (Stripe or Paystack).
   * @param {string} orderId
   * @param {number} refundAmount - Amount to refund
   * @param {string} reason       - Reason for refund
   */
  async refundPayment(orderId, refundAmount, reason) {
    try {
      const payment = await PaymentModel.findSuccessfulByOrderId(orderId);
      if (!payment) {
        throw new Error(`No successful payment record found for order ${orderId}`);
      }

      let rawResponse = null;

      if (payment.provider === 'stripe') {
        const session = await stripeClient.checkout.sessions.retrieve(payment.reference);
        const paymentIntentId = session.payment_intent;
        if (!paymentIntentId) {
          throw new Error(`No payment intent found on Stripe session ${payment.reference}`);
        }

        const refund = await stripeClient.refunds.create({
          payment_intent: paymentIntentId,
          amount: Math.round(refundAmount * 100),
        });
        rawResponse = refund;
      } else if (payment.provider === 'paystack') {
        const response = await fetch('https://api.paystack.co/refund', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transaction: payment.reference,
            amount: Math.round(refundAmount * 100),
            customer_note: reason || 'Refund for returned items'
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || 'Paystack refund failed');
        }
        rawResponse = result.data;
      } else {
        throw new Error(`Unsupported payment provider for refunds: ${payment.provider}`);
      }

      await PaymentModel.updateStatus(payment.id, 'refunded', rawResponse);

      // Audit log the refund
      AuditService.log(null, 'payment.refunded', 'order', orderId, null, {
        paymentId: payment.id,
        refundAmount,
        provider: payment.provider,
        reason
      });

      return { success: true, refundAmount };
    } catch (error) {
      console.error(`[Payment] Refund failed for order ${orderId}:`, error.message);
      throw error;
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
