const supabase = require('../config/supabase');

class OrderModel {
  async create(orderData, items) {
    // Check if an order with checkout_session_id already exists to prevent duplicate creation
    if (orderData.checkout_session_id) {
      const existing = await this.findByCheckoutSessionId(orderData.checkout_session_id);
      if (existing) {
        return existing;
      }
    }

    try {
      const { data, error } = await supabase.rpc('create_order_with_items', {
        p_order_data: orderData,
        p_order_items: items
      });

      if (error) {
        // Unique key constraint violation fallback (in case of concurrent race condition)
        if (error.code === '23505' && orderData.checkout_session_id) {
          const existing = await this.findByCheckoutSessionId(orderData.checkout_session_id);
          if (existing) return existing;
        }
        throw error;
      }
      return data;
    } catch (error) {
      if (error.code === '23505' && orderData.checkout_session_id) {
        const existing = await this.findByCheckoutSessionId(orderData.checkout_session_id);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async findById(id, storeId = null) {
    let query = supabase
      .from('orders')
      .select('*, items:order_items(*)');

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.eq('id', id).single();

    if (error) throw error;
    return data;
  }

  async findByOrderNumber(orderNumber, storeId = null) {
    let query = supabase
      .from('orders')
      .select('*, items:order_items(*)');

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.eq('order_number', orderNumber).single();

    if (error) throw error;
    return data;
  }

  async updateStatus(id, status, paymentStatus = null, note = null, changedBy = null) {
    const now = new Date().toISOString();
    const updateData = { status, updated_at: now };
    if (paymentStatus) updateData.payment_status = paymentStatus;

    // Set milestone timestamps
    if (status === 'shipped')             updateData.shipped_at             = now;
    if (status === 'out_for_delivery')    updateData.out_for_delivery_at    = now;
    if (status === 'delivery_attempted')  updateData.attempted_at           = now;
    if (status === 'delivered')           updateData.delivered_at           = now;
    if (status === 'completed')           updateData.completed_at           = now;
    if (status === 'cancelled')           updateData.cancelled_at           = now;
    if (paymentStatus === 'paid')         updateData.paid_at                = now;

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async findByUserId(userId, filters = {}, pagination = { page: 1, limit: 10 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (filters.store_id) query = query.eq('store_id', filters.store_id);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { 
      orders: data, 
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async findAll(filters = {}, pagination = { page: 1, limit: 10 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('orders')
      .select('*, user:users(first_name, last_name, email)', { count: 'exact' });

    if (filters.store_id) query = query.eq('store_id', filters.store_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { 
      orders: data, 
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('orders')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
  async findByCheckoutSessionId(checkoutSessionId) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('checkout_session_id', checkoutSessionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Returns orders that are paid/confirmed but not yet assigned to a driver.
   * Used by the admin dispatch queue view.
   */
  async getDispatchQueue(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('orders')
      .select('*, user:users(first_name, last_name, email)', { count: 'exact' })
      .in('status', ['confirmed', 'processing', 'ready_for_dispatch', 'dispatched', 'out_for_delivery', 'delivery_attempted']);

    if (filters.store_id)        query = query.eq('store_id', filters.store_id);
    if (filters.status)          query = query.eq('status', filters.status);
    if (filters.deliveryStatus)  query = query.eq('delivery_status', filters.deliveryStatus);
    if (filters.dateFrom)        query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo)          query = query.lte('created_at', filters.dateTo);

    // Stale-order SLA filter: only return orders not updated within N minutes
    if (filters.staleSinceMinutes) {
      const cutoff = new Date(Date.now() - filters.staleSinceMinutes * 60 * 1000).toISOString();
      query = query.lt('updated_at', cutoff);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return {
      orders: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async claimGuestOrders(userId, email, storeId = null) {
    let query = supabase
      .from('orders')
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .is('user_id', null)
      .eq('customer_email', email);

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.select();
    if (error) throw error;
    return data;
  }

  async findAllWithoutPagination(filters = {}) {
    let query = supabase
      .from('orders')
      .select('*, user:users(first_name, last_name, email)');

    if (filters.store_id) query = query.eq('store_id', filters.store_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) throw error;
    return data || [];
  }
}

module.exports = new OrderModel();
