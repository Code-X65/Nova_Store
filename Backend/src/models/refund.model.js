const supabase = require('../config/supabase');
const { SINGLE_STORE_ID } = require('../config/store');

class RefundModel {
  async create(data) {
    const { data: row, error } = await supabase
      .from('refunds')
      .insert([{ ...data, store_id: SINGLE_STORE_ID }])
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async update(id, updates) {
    const { data, error } = await supabase
      .from('refunds')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async listByOrder(orderId) {
    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async list(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('refunds')
      .select('*, order:orders(order_number, customer_email)', { count: 'exact' })
      .eq('store_id', SINGLE_STORE_ID);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.orderId) query = query.eq('order_id', filters.orderId);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    return {
      refunds: data,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
    };
  }
}

module.exports = new RefundModel();
