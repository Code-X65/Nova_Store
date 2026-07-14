const supabase = require('../config/supabase');
const OrderModel = require('../models/order.model');
const OrderStatusHistoryModel = require('../models/order-status-history.model');
const logger = require('../utils/logger');
const { SINGLE_STORE_ID } = require('../config/store');

/**
 * Order Status State Machine (Phase 4 §5.1)
 *
 * Single source of truth for valid order status transitions. Every
 * status change (generic update path + the dedicated /transition
 * endpoint) is validated against the `order_status_transitions`
 * table so illegal jumps are impossible.
 */
class OrderStateMachine {
  /**
   * List allowed next statuses for a given current status.
   * @returns {Promise<Array<{to_status:string, requires_note:boolean, is_terminal:boolean}>>}
   */
  async listAllowed(currentStatus) {
    const { data, error } = await supabase
      .rpc('allowed_order_transitions', { p_status: currentStatus });
    if (error) throw error;
    return data || [];
  }

  /**
   * Is the transition fromStatus -> toStatus permitted?
   */
  async isAllowed(fromStatus, toStatus) {
    if (fromStatus === toStatus) return true;
    const { data, error } = await supabase
      .from('order_status_transitions')
      .select('*')
      .eq('from_status', fromStatus)
      .eq('to_status', toStatus)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  /**
   * Enforce a transition, returning the transition rule (with
   * requires_note) or null when not permitted.
   */
  async getRule(fromStatus, toStatus) {
    const { data, error } = await supabase
      .from('order_status_transitions')
      .select('*')
      .eq('from_status', fromStatus)
      .eq('to_status', toStatus)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  /**
   * Perform a validated transition. Persists the new status, writes a
   * history row, and returns the updated order.
   */
  async transition(orderId, toStatus, { actorId, note } = {}) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');
    if (order.status === toStatus) return order;

    const rule = await this.getRule(order.status, toStatus);
    if (!rule) {
      const err = new Error(
        `Invalid order transition: ${order.status} → ${toStatus}`
      );
      err.statusCode = 422;
      throw err;
    }
    if (rule.requires_note && !note) {
      const err = new Error(`Transition to '${toStatus}' requires a note`);
      err.statusCode = 422;
      throw err;
    }

    const updated = await OrderModel.updateStatus(orderId, toStatus, null, note || `Transitioned to ${toStatus}`, actorId);
    await OrderStatusHistoryModel.create({ order_id: orderId, status: toStatus, note: note || `Transitioned to ${toStatus}`, changed_by: actorId });
    logger.info(`[OrderStateMachine] ${order.order_number}: ${order.status} → ${toStatus}`);
    return updated;
  }
}

module.exports = new OrderStateMachine();
