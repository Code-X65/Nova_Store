const supabase = require('../config/supabase');

/**
 * Model for the delivery_dispatches table.
 * Each row represents one dispatch assignment for an order.
 * Multiple rows per order are possible (e.g. rescheduled deliveries),
 * but only one should be in an active state at a time.
 */
class DeliveryDispatchModel {
  /**
   * Create a new dispatch record.
   * @param {object} data
   * @param {string} data.order_id
   * @param {string} data.assigned_by - admin user ID
   * @param {string} data.driver_name
   * @param {string} [data.driver_phone]
   * @param {string} [data.dispatch_notes]
   */
  async create(data) {
    const { data: dispatch, error } = await supabase
      .from('delivery_dispatches')
      .insert([{
        order_id:      data.order_id,
        assigned_by:   data.assigned_by,
        driver_name:   data.driver_name,
        driver_phone:  data.driver_phone || null,
        rider_id:      data.rider_id || null,
        rider_name:    data.rider_name || null,
        rider_phone:   data.rider_phone || null,
        dispatch_notes: data.dispatch_notes || null,
        status:        'assigned',
        dispatched_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return dispatch;
  }

  /**
   * Find all dispatch records for a given order (most recent first).
   */
  async findByOrderId(orderId) {
    const { data, error } = await supabase
      .from('delivery_dispatches')
      .select('*, assigned_by_user:users(first_name, last_name)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Find the most recent active dispatch for an order.
   * "Active" means status is not delivered or returned_to_store.
   */
  async findActiveByOrderId(orderId) {
    const { data, error } = await supabase
      .from('delivery_dispatches')
      .select('*')
      .eq('order_id', orderId)
      .not('status', 'in', '("delivered","returned_to_store")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Update a dispatch record's status and optional milestone timestamps.
   * @param {string} dispatchId
   * @param {object} updates - fields to update on the dispatch row
   */
  async updateById(dispatchId, updates) {
    const { data, error } = await supabase
      .from('delivery_dispatches')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', dispatchId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update status of the most recent dispatch for an order.
   * Convenience wrapper used by OrderService milestone methods.
   */
  async updateStatusByOrderId(orderId, status, extraFields = {}) {
    const dispatch = await this.findActiveByOrderId(orderId);
    if (!dispatch) return null;

    return await this.updateById(dispatch.id, { status, ...extraFields });
  }
}

module.exports = new DeliveryDispatchModel();
