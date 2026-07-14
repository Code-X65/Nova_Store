const supabase = require('../config/supabase');
const { SINGLE_STORE_ID } = require('../config/store');

class DisputeModel {
  async create(data) {
    const { data: row, error } = await supabase
      .from('disputes')
      .insert([{ ...data, store_id: SINGLE_STORE_ID }])
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async update(id, updates) {
    const { data, error } = await supabase
      .from('disputes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('disputes')
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
      .from('disputes')
      .select('*, order:orders(order_number, customer_email)', { count: 'exact' })
      .eq('store_id', SINGLE_STORE_ID);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.breaching) {
      // SLA breaches (not resolved/closed/escalated)
      query = query.lt('sla_due_at', new Date().toISOString())
        .not('status', 'in', '(resolved,closed,escalated)');
    }

    const { data, error, count } = await query
      .order('sla_due_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    return {
      disputes: data,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
    };
  }
}

module.exports = new DisputeModel();
