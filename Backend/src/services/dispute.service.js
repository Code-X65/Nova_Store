const DisputeModel = require('../models/dispute.model');
const OrderModel = require('../models/order.model');
const AuditService = require('./audit.service');
const { SINGLE_STORE_ID } = require('../config/store');

/**
 * Dispute service (Phase 4 §5.3)
 *
 * Buyer↔store disputes with SLA timers (default 72h, set by DB
 * trigger). Single-vendor: disputes are between customer and the
 * store, not third-party sellers.
 */
class DisputeService {
  async createDispute({ orderId, openedBy, subject, description, priority = 'medium', assignedTo, slaDueAt } = {}) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    return await DisputeModel.create({
      order_id: order.id,
      opened_by: openedBy,
      subject,
      description,
      priority,
      assigned_to: assignedTo || null,
      sla_due_at: slaDueAt || null
    });
  }

  async getDispute(id) {
    return await DisputeModel.findById(id);
  }

  async listDisputes(filters, pagination) {
    return await DisputeModel.list(filters, pagination);
  }

  async assign(id, assignedTo, req = null) {
    const updated = await DisputeModel.update(id, { assigned_to: assignedTo });
    if (req) await AuditService.log(req, 'dispute.assigned', 'dispute', id, null, { assignedTo });
    return updated;
  }

  async escalate(id, req = null) {
    const updated = await DisputeModel.update(id, { status: 'escalated' });
    if (req) await AuditService.log(req, 'dispute.escalated', 'dispute', id, null, {});
    return updated;
  }

  /**
   * Resolve a dispute. finance:approve / disputes:resolve enforced at
   * the route layer. Sets resolved_at and clears the SLA clock.
   */
  async resolve(id, { resolution, resolutionNotes, status = 'resolved' } = {}, req = null) {
    const updated = await DisputeModel.update(id, {
      status,
      resolution: resolution || 'resolved',
      resolution_notes: resolutionNotes || null,
      resolved_at: new Date().toISOString()
    });
    if (req) {
      await AuditService.log(req, 'dispute.resolved', 'dispute', id, null, { resolution, status });
    }
    return updated;
  }
}

module.exports = new DisputeService();
