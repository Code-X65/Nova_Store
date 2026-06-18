const OrderModel = require('../models/order.model');
const PaymentModel = require('../models/payment.model');
const InventoryService = require('./inventory.service');
const CartService = require('./cart.service');
const CouponService = require('./coupon.service');
const InventoryReservationService = require('./inventory-reservation.service');
const AuditService = require('./audit.service');
const SettingModel = require('../models/setting.model');
const crypto = require('crypto');
const CircuitBreaker = require('../utils/circuit-breaker');
const contextStore = require('../utils/context');

const paystackRequest = async ({ url, method, body, customHeaders = {} }) => {
  const store = contextStore.getStore();
  const reqId = store?.requestId;
  
  const headers = {
    ...customHeaders
  };
  if (reqId) {
    headers['X-Request-ID'] = reqId;
    headers['traceparent'] = `00-${reqId.replace(/-/g, '')}-0000000000000001-01`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || `Paystack API returned HTTP ${response.status}`);
  }
  return result;
};

const paystackBreaker = new CircuitBreaker(paystackRequest, {
  failureThreshold: 5,
  cooldownPeriod: 30000
});

async function getPaystackSecretKey() {
  let secretKey = process.env.PAYSTACK_SECRET_KEY;
  try {
    const setting = await SettingModel.getByKey('paystack_secret_key');
    if (setting && setting.value) {
      secretKey = setting.value;
    }
  } catch (err) {
    // Fallback
  }
  return secretKey;
}

class PaymentService {
  async initializePaystack(userId, email, amount, checkoutSessionId) {
    try {
      const paystackSecretKey = await getPaystackSecretKey();
      const result = await paystackBreaker.execute({
        url: 'https://api.paystack.co/transaction/initialize',
        method: 'POST',
        body: {
          email,
          amount: Math.round(amount * 100), // convert to kobo
          metadata: { checkoutSessionId, userId }
        },
        customHeaders: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        }
      });

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
      const paystackSecretKey = await getPaystackSecretKey();
      const result = await paystackBreaker.execute({
        url: `https://api.paystack.co/transaction/verify/${reference}`,
        method: 'GET',
        customHeaders: {
          'Authorization': `Bearer ${paystackSecretKey}`
        }
      });

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
    if (!await this.verifySignature(provider, payload, signature)) {
      throw new Error('Invalid signature');
    }

    // 2. Process based on provider
    if (provider === 'paystack') {
      const { event, data } = payload;
      if (event === 'charge.success') {
        await this.handleSuccessfulPayment(data.reference, 'paystack', data);
      }
    }
    
    return { success: true };
  }

  async verifySignature(provider, payload, signature) {
    if (provider === 'paystack') {
      const paystackSecretKey = await getPaystackSecretKey();
      const hash = crypto.createHmac('sha512', paystackSecretKey)
                         .update(JSON.stringify(payload))
                         .digest('hex');
      return hash === signature;
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
      console.error(`[Payment] No payment record found for reference ${reference} (${provider}).`);
      return;
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
   * Refund a successful payment via the gateway (Paystack).
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

      if (payment.provider === 'paystack') {
        const paystackSecretKey = await getPaystackSecretKey();
        const result = await paystackBreaker.execute({
          url: 'https://api.paystack.co/refund',
          method: 'POST',
          body: {
            transaction: payment.reference,
            amount: Math.round(refundAmount * 100),
            customer_note: reason || 'Refund for returned items'
          },
          customHeaders: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        });
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
