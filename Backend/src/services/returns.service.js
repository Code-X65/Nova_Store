const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ReturnsModel = require('../models/returns.model');
const OrderModel = require('../models/order.model');
const InventoryService = require('./inventory.service');
const RefundService = require('./refund.service');
const AuditService = require('./audit.service');
const logger = require('../utils/logger');
const { SINGLE_STORE_ID } = require('../config/store');

const LABEL_DIR = path.join(__dirname, '../../uploads/return-labels');

const ACTION_TO_STATUS = {
  review: 'under_review',
  approve: 'approved',
  reject: 'rejected',
  schedule_pickup: 'pickup_scheduled',
  mark_collected: 'collected',
  complete_qc: 'qc_received',
  process_refund: 'refund_pending',
  complete: 'completed'
};

/**
 * Reverse-logistics / RMA engine (Phase 5 §7.3)
 *
 * Full return lifecycle with return-label generation and
 * restock-on-receipt. Refund release is gated by item receipt
 * (collected → QC passed) — a refund cannot be released until the
 * goods are physically back and inspected.
 */
class ReturnsService {
  async createRma({ orderId, reason, condition, returnMethod = 'pickup', refundAmount, createdBy } = {}) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'delivered' && order.status !== 'returned') {
      throw new Error('Returns can only be opened for delivered/returned orders');
    }

    const rmaNumber = `RMA-${order.order_number}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return await ReturnsModel.create({
      order_id: order.id,
      rma_number: rmaNumber,
      status: 'requested',
      reason,
      condition: condition || null,
      return_method: returnMethod,
      refund_amount: refundAmount || 0,
      created_by: createdBy
    });
  }

  async getRma(id) {
    return await ReturnsModel.findById(id);
  }

  async listForOrder(orderId) {
    return await ReturnsModel.findByOrderId(orderId);
  }

  async listReturns(filters, pagination) {
    return await ReturnsModel.list(filters, pagination);
  }

  /**
   * Advance an RMA through a validated transition.
   */
  async transition(returnId, action, { note, adminId, condition, qcOutcome, refundAmount, req } = {}) {
    const rma = await ReturnsModel.findById(returnId);
    if (!rma) throw new Error('RMA not found');

    const validActions = Object.keys(ACTION_TO_STATUS);
    if (!validActions.includes(action)) {
      throw new Error(`Invalid RMA action: ${action}`);
    }

    const toStatus = ACTION_TO_STATUS[action];
    const allowed = await this._isAllowed(rma.status, toStatus);
    if (!allowed) {
      throw new Error(`Invalid RMA transition: ${rma.status} → ${toStatus}`);
    }

    const update = { status: toStatus };
    if (condition) update.condition = condition;
    if (refundAmount != null) update.refund_amount = refundAmount;

    // Restock-on-receipt: only sellable items return to inventory
    if (action === 'complete_qc') {
      if (!qcOutcome) throw new Error('qcOutcome is required for complete_qc');
      update.condition = qcOutcome;
      if (qcOutcome === 'sellable' && rma.order_id) {
        const order = await OrderModel.findById(rma.order_id, SINGLE_STORE_ID);
        for (const item of order.items || []) {
          try {
            await InventoryService.addStock(
              item.product_id,
              item.quantity,
              adminId,
              `RMA ${rma.rma_number} QC passed — sellable stock reintegrated`,
              item.variant_id
            );
          } catch (err) {
            logger.warn(`[Returns] restock failed for item ${item.product_id}: ${err.message}`);
          }
        }
      }
    }

    // process_refund: create a pending refund (released via refund endpoints)
    if (action === 'process_refund') {
      const amount = refundAmount != null ? refundAmount : (rma.refund_amount || 0);
      if (amount > 0) {
        update.refund_amount = amount;
        await RefundService.createRefund({
          orderId: rma.order_id,
          amount,
          reason: `RMA ${rma.rma_number}`,
          method: 'original_payment',
          requestedBy: adminId
        });
      }
    }

    // complete: refund gated by receipt — require a completed refund when due
    if (action === 'complete') {
      const refunds = await RefundService.listForOrder(rma.order_id);
      const owed = Number(rma.refund_amount) > 0;
      const completedRefund = refunds.find(r => r.status === 'completed');
      if (owed && !completedRefund) {
        throw new Error('Cannot complete return: refund has not been released (goods not yet refunded)');
      }
      await OrderModel.update(rma.order_id, { status: 'returned' });
    }

    const updated = await ReturnsModel.update(returnId, update);
    if (req) await AuditService.log(req, `returns.${action}`, 'return', returnId, null, { toStatus });

    // Keep the order's legacy return_status in sync at every step — not just
    // on 'complete' — since any UI still reading order.return_status
    // (customer-facing order detail, older admin screens) would otherwise
    // show a stale/blank status through the entire RMA lifecycle and only
    // correct itself at the very end. The RMA vocabulary mirrors the legacy
    // one field-for-field except for the terminal state.
    const legacyReturnStatus = action === 'complete' ? 'refund_completed' : toStatus;
    await OrderModel.update(rma.order_id, { return_status: legacyReturnStatus }).catch((syncErr) => {
      logger.warn(`[Returns] Failed to sync order ${rma.order_id} return_status to '${legacyReturnStatus}': ${syncErr.message}`);
    });

    return updated;
  }

  /**
   * Generate a return shipping label and store it.
   */
  async generateLabel(returnId, { carrier = 'Nova Local', trackingNumber } = {}) {
    const rma = await ReturnsModel.findById(returnId);
    if (!rma) throw new Error('RMA not found');

    fs.mkdirSync(LABEL_DIR, { recursive: true });
    const labelName = `return-${rma.rma_number}.txt`;
    const content = [
      'NOVA STORE — RETURN LABEL',
      '---------------------------',
      `RMA:     ${rma.rma_number}`,
      `Order:   ${(rma.order && rma.order.order_number) || rma.order_id}`,
      `Carrier: ${carrier}`,
      `Tracking:${trackingNumber || 'TBD'}`,
      `Generated:${new Date().toISOString()}`
    ].join('\n');
    fs.writeFileSync(path.join(LABEL_DIR, labelName), content);

    return await ReturnsModel.createLabel({
      return_id: returnId,
      carrier,
      label_url: `/uploads/return-labels/${labelName}`,
      tracking_number: trackingNumber || null
    });
  }

  async listLabels(returnId) {
    return await ReturnsModel.listLabels(returnId);
  }

  async _isAllowed(fromStatus, toStatus) {
    const supabase = require('../config/supabase');
    const { data, error } = await supabase
      .from('return_status_transitions')
      .select('*')
      .eq('from_status', fromStatus)
      .eq('to_status', toStatus)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }
}

module.exports = new ReturnsService();
