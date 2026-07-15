const OrderModel = require('../models/order.model');
const PaymentModel = require('../models/payment.model');
const RefundModel = require('../models/refund.model');
const OrderStateMachine = require('./order-state-machine.service');
const InventoryService = require('./inventory.service');
const CartService = require('./cart.service');
const CouponService = require('./coupon.service');
const InventoryReservationService = require('./inventory-reservation.service');
const InventoryAlertService = require('./inventory-alert.service');
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

      // Release the stock held for this checkout — otherwise it stays "reserved"
      // forever since the order will never be paid through this reference.
      if (order.checkout_session_id) {
        await this.releaseReservations(order.checkout_session_id);
      }

      // Same for any coupon usage claimed at checkout — it must not permanently
      // consume the coupon's usage slot for a payment that never went through.
      if (order.coupon_id) {
        try {
          await CouponService.releaseCouponUsage(order.coupon_id, order.id);
        } catch (couponErr) {
          console.error(`[Payment] Failed to release coupon usage for order ${order.id}:`, couponErr.message);
        }
      }

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

      // A late/retried gateway webhook must not resurrect an order that was
      // already cancelled or refunded — that would re-commit stock and put a
      // dead order back into the fulfillment pipeline. The payment itself was
      // already marked 'success' above (money was genuinely received), so this
      // is surfaced as a critical event for manual finance/ops reconciliation
      // rather than silently discarded or silently applied.
      const BLOCKED_STATUSES = ['cancelled', 'refunded', 'returned'];
      if (BLOCKED_STATUSES.includes(order.status)) {
        console.error(`[Payment] Payment ${reference} succeeded for order ${order.order_number} which is already '${order.status}' — order NOT resurrected. Needs manual reconciliation.`);
        AuditService.log(null, 'payment.succeeded_on_blocked_order', 'order', orderId, null, {
          reference, provider, orderStatus: order.status, total: order.total_amount, orderNumber: order.order_number
        });
        eventBus.emit('payment.reconciliation_required', {
          actor: { id: null, fullName: 'Payment Gateway', role: 'system' },
          resourceType: 'order',
          resourceId: orderId,
          actionType: 'STATUS_CHANGE',
          severity: 'critical',
          title: 'Payment received for a closed order',
          message: `Payment of ${order.total_amount} for order #${order.order_number} succeeded, but the order is already '${order.status}'. Manual reconciliation required.`,
          data: { orderId, orderNumber: order.order_number, reference, provider, total: order.total_amount, orderStatus: order.status },
          deepLink: `/orders/${orderId}`,
        });
        return;
      }

      // Route through the shared state machine so any status this webhook
      // wasn't already explicitly aware of (not just the BLOCKED_STATUSES
      // above) is still validated, rather than blindly overwriting status.
      await OrderStateMachine.assertAllowed(order.status, 'processing');
      await OrderModel.updateStatus(orderId, 'processing', 'paid');

      // 3. Commit reserved stock → real stock reduction
      try {
        await InventoryReservationService.commitReservedStock(orderId);
      } catch (commitErr) {
        console.error(`[Payment] commitReservedStock warning for order ${orderId}:`, commitErr.message);
      }

      // 3b. Check for low-stock breaches now that real stock was decremented.
      const checkedProductIds = new Set();
      for (const item of order.items || []) {
        if (checkedProductIds.has(item.product_id)) continue;
        checkedProductIds.add(item.product_id);
        InventoryAlertService.checkProductStock(item.product_id).catch((alertErr) => {
          console.error(`[Payment] Low-stock check failed for product ${item.product_id}:`, alertErr.message);
        });
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

      // 5b. Mark any pending abandoned-cart reminders as recovered (best-effort)
      try {
        const CartRecoveryService = require('./cart-recovery.service');
        await CartRecoveryService.markRecovered(order.user_id);
      } catch (recoveryErr) {
        console.error(`Failed to mark cart recovery for order ${orderId}:`, recoveryErr.message);
      }

      // Confirm the coupon usage claimed at checkout — delegated to CouponService (single source of truth)
      if (order.coupon_id) {
        try {
          await CouponService.recordCouponUsage(order.user_id, order.coupon_id, orderId);
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
      const order = await OrderModel.findById(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Cap the refund against what's actually left to refund on this order.
      // Two independent refund systems both eventually call this method
      // (RefundService's `refunds` table, and OrderService.processReturn's
      // legacy `orders.refund_amount` field) — enforcing the cap here, at
      // their shared choke point, is what actually closes the gap where
      // either path (or both) could refund more than the customer paid.
      // Note: if the same order were ever refunded through BOTH systems, this
      // could still under-count already-refunded totals from one system while
      // reading the other — there's no unified refund ledger — but this is
      // strictly safer than the previous zero-cap behavior.
      const priorRefunds = await RefundModel.listByOrder(orderId);
      const refundedViaRefundsTable = priorRefunds
        .filter((r) => ['completed', 'processing'].includes(r.status))
        .reduce((sum, r) => sum + Number(r.amount), 0);
      const refundedViaOrderField = ['completed', 'pending', 'processing'].includes(order.refund_status)
        ? Number(order.refund_amount || 0)
        : 0;
      const alreadyRefunded = refundedViaRefundsTable + refundedViaOrderField;
      const remaining = Number(order.total_amount) - alreadyRefunded;

      if (Number(refundAmount) > remaining + 0.01) { // small epsilon for float rounding
        throw new Error(
          `Refund amount ${refundAmount} exceeds the remaining refundable balance of ${remaining.toFixed(2)} ` +
          `for order ${orderId} (already refunded ${alreadyRefunded.toFixed(2)} of ${Number(order.total_amount).toFixed(2)}).`
        );
      }

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
