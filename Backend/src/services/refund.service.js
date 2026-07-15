const RefundModel = require('../models/refund.model');
const OrderModel = require('../models/order.model');
const UserModel = require('../models/user.model');
const PaymentService = require('./payment.service');
const NotificationService = require('./notification.service');
const AuditService = require('./audit.service');
const eventBus = require('../realtime/event-bus');
const logger = require('../utils/logger');
const { SINGLE_STORE_ID } = require('../config/store');

async function resolveUserName(userId) {
  try {
    const user = await UserModel.findById(userId);
    if (!user) return 'Customer';
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Customer';
  } catch {
    return 'Customer';
  }
}

/**
 * Refund service (Phase 4 §5.3)
 *
 * Refunds are created as `pending` and require finance:approve before
 * the payment gateway is invoked. Single destination: all order
 * revenue belongs to the single store (no split payouts).
 */
class RefundService {
  async createRefund({ orderId, amount, reason, method = 'original_payment', requestedBy, notes } = {}) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');
    if (Number(amount) <= 0) throw new Error('Refund amount must be greater than zero');

    const refund = await RefundModel.create({
      order_id: order.id,
      amount,
      reason,
      method,
      status: 'pending',
      requested_by: requestedBy,
      notes
    });

    eventBus.emit('refund.requested', {
      actor: { id: requestedBy, fullName: await resolveUserName(requestedBy), role: 'admin' },
      resourceType: 'refund',
      resourceId: refund.id,
      actionType: 'CREATE',
      severity: 'info',
      title: 'Refund requested',
      message: `A refund of ${amount} was requested for order #${order.order_number}, pending approval.`,
      data: { refundId: refund.id, orderId: order.id, orderNumber: order.order_number, amount, reason },
      deepLink: `/orders/${order.id}`,
    });

    return refund;
  }

  async getRefund(id) {
    return await RefundModel.findById(id);
  }

  async listRefunds(filters, pagination) {
    return await RefundModel.list(filters, pagination);
  }

  async listForOrder(orderId) {
    return await RefundModel.listByOrder(orderId);
  }

  /**
   * Approve + process a pending refund via the payment gateway.
   * Requires finance:approve (enforced at route layer). On gateway
   * failure the refund is marked `failed` and the error is surfaced.
   */
  async approveAndProcess(refundId, adminId, req = null) {
    const refund = await RefundModel.findById(refundId);
    if (!refund) throw new Error('Refund not found');
    if (refund.status !== 'pending') {
      throw new Error(`Refund is already in '${refund.status}' state and cannot be processed`);
    }

    const order = await OrderModel.findById(refund.order_id);

    await RefundModel.update(refundId, {
      status: 'processing',
      approved_by: adminId,
      approved_at: new Date().toISOString()
    });

    let updated;
    try {
      const result = await PaymentService.refundPayment(
        refund.order_id,
        Number(refund.amount),
        refund.reason || 'Approved refund'
      );
      updated = await RefundModel.update(refundId, {
        status: 'completed',
        processed_at: new Date().toISOString(),
        gateway_reference: result && result.reference ? String(result.reference) : null
      });

      if (order?.user_id) {
        NotificationService.sendToUser(order.user_id, 'refund_completed', {
          userName: await resolveUserName(order.user_id),
          orderNumber: order.order_number,
          refundAmount: Number(refund.amount).toFixed(2)
        }).catch((notifErr) => {
          logger.error(`[RefundService] Failed to notify customer for refund ${refundId}:`, notifErr.message);
        });
      }

      eventBus.emit('refund.completed', {
        actor: { id: adminId, fullName: await resolveUserName(adminId), role: 'admin' },
        resourceType: 'refund',
        resourceId: refundId,
        actionType: 'STATUS_CHANGE',
        severity: 'info',
        title: 'Refund completed',
        message: `A refund of ${refund.amount} for order #${order?.order_number || refund.order_id} was completed.`,
        data: { refundId, orderId: refund.order_id, orderNumber: order?.order_number, amount: refund.amount },
        deepLink: `/orders/${refund.order_id}`,
      });
    } catch (err) {
      await RefundModel.update(refundId, { status: 'failed', notes: `Gateway error: ${err.message}` });
      logger.error(`[RefundService] gateway failed for ${refundId}: ${err.message}`);

      eventBus.emit('refund.failed', {
        actor: { id: adminId, fullName: await resolveUserName(adminId), role: 'admin' },
        resourceType: 'refund',
        resourceId: refundId,
        actionType: 'STATUS_CHANGE',
        severity: 'critical',
        title: 'Refund failed',
        message: `Refund of ${refund.amount} for order #${order?.order_number || refund.order_id} failed at the payment gateway: ${err.message}`,
        data: { refundId, orderId: refund.order_id, orderNumber: order?.order_number, amount: refund.amount, error: err.message },
        deepLink: `/orders/${refund.order_id}`,
      });

      const e = new Error(`Payment gateway refund failed: ${err.message}`);
      e.statusCode = 502;
      throw e;
    }

    if (req) {
      await AuditService.log(req, 'finance.refund.approved', 'refund', refundId, null, { amount: refund.amount });
    }
    return updated;
  }

  async cancelRefund(refundId, adminId) {
    const refund = await RefundModel.findById(refundId);
    if (!refund) throw new Error('Refund not found');
    if (!['pending', 'failed'].includes(refund.status)) {
      throw new Error('Only pending or failed refunds can be cancelled');
    }
    return await RefundModel.update(refundId, { status: 'cancelled' });
  }
}

module.exports = new RefundService();
