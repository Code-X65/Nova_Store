const supabase = require('../config/supabase');

class OrderStatusHistoryModel {
  async findByOrderId(orderId) {
    const { data, error } = await supabase
      .from('order_status_history')
      .select('*, changed_by_user:users(first_name, last_name)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async create(historyData) {
    const { data, error } = await supabase
      .from('order_status_history')
      .insert([historyData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new OrderStatusHistoryModel();
