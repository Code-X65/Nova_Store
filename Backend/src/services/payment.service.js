const OrderModel = require('../models/order.model');
const PaymentModel = require('../models/payment.model');
const InventoryService = require('./inventory.service');
const CartService = require('./cart.service');
const CouponService = require('./coupon.service');
const InventoryReservationService = require('./inventory-reservation.service');
const AuditService = require('./audit.service');
const eventBus = require('../realtime/event-bus');
const SettingModel = require('../models/setting.model');
const crypto = require('crypto');
const CircuitBreaker = require('../utils/circuit-breaker');
const contextStore = require('../utils/context');
const PaymentGatewayFactory = require('./payment-gateways/factory');

class PaymentService {
  async initializePayment(provider, userId, email, amount, checkoutSessionId) {
    const gateway = PaymentGatewayFactory.getGateway(provider);
    return await gateway.initialize({ userId, email, amount, checkoutSessionId });
  }

  async initializePaystack(userId, email, amount, checkoutSessionId) {
    return this.initializePayment('paystack', userId, email, amount, checkoutSessionId);
  }

  async verifyPayment(provider, reference) {
    const gateway = PaymentGatewayFactory.getGateway(provider);
    const data = await gateway.verify(reference);
    if (data.status === 'success') {
      await this.handleSuccessfulPayment(data.reference, provider, data);
    } else {
      await this.handleFailedPayment(reference, provider, data);
    }
    return data;
  }

  async handleFailedPayment(reference, provider, rawResponse) {
    try {
      const payment = await PaymentModel.findByReference(reference);
      if (!payment || !payment.order_id) return;
      const order = await OrderModel.findById(payment.order_id);
      if (!order) return;

      await PaymentModel.updateStatus(payment.id, 'failed', rawResponse);

      AuditService.log(null, 'payment.failed', 'order', order.id, null, {
        reference, provider, orderNumber: order.order_number
      });

      eventBus.emit('order.payment_failed', {
        actor: { id: order.user_id, fullName: null, role: 'customer' },
        resourceType: 'order',
        resourceId: order.id,
        actionType: 'STATUS_CHANGE',
        severity: 'warning',
        title: 'Payment failed',
        message: `Payment for order #${order.order_number} failed (${provider}).`,
        data: { orderId: order.id, orderNumber: order.order_number, reference },
        deepLink: `/orders/${order.id}`,
      });
    } catch (err) {
      console.error(`[Payment] handleFailedPayment error for ${reference}:`, err.message);
    }
  }

  async verifyPaystack(reference) {
    return this.verifyPayment('paystack', reference);
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
    try {
      const gateway = PaymentGatewayFactory.getGateway(provider);
      return await gateway.verifySignature(payload, signature);
    } catch (err) {
      return false;
    }
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

      eventBus.emit('order.payment_succeeded', {
        actor: { id: order.user_id, fullName: null, role: 'customer' },
        resourceType: 'order',
        resourceId: orderId,
        actionType: 'STATUS_CHANGE',
        severity: 'info',
        title: 'Payment successful',
        message: `Payment of ${order.total_amount} for order #${order.order_number} was successful (${provider}).`,
        data: { orderId, orderNumber: order.order_number, reference, provider, total: order.total_amount },
        deepLink: `/orders/${orderId}`,
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

      // 6. Send Confirmation Email
      try {
        const NotificationService = require('./notification.service');
        await NotificationService.sendOrderConfirmation(order.user_id, order.order_number, order.total_amount);
      } catch (notifErr) {
        console.error(`Failed to send confirmation email for order ${orderId}:`, notifErr.message);
      }
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

      const gateway = PaymentGatewayFactory.getGateway(payment.provider);
      const rawResponse = await gateway.refund(payment.reference, refundAmount, reason);

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
