const supabase = require('../config/supabase');
const { SINGLE_STORE_ID } = require('../config/store');

class InvoiceModel {
  async create(data) {
    const { data: row, error } = await supabase
      .from('invoices')
      .insert([{ ...data, store_id: SINGLE_STORE_ID }])
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async findByOrderId(orderId) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async list(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('invoices')
      .select('*, order:orders(order_number, status, customer_email)', { count: 'exact' })
      .eq('store_id', SINGLE_STORE_ID);

    if (filters.orderNumber) query = query.ilike('order_number', `%${filters.orderNumber}%`);
    if (filters.dateFrom) query = query.gte('issued_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('issued_at', filters.dateTo);

    const { data, error, count } = await query
      .order('issued_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    return {
      invoices: data,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
    };
  }
}

module.exports = new InvoiceModel();
