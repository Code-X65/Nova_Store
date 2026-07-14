const supabase = require('../config/supabase');

class CustomerEventModel {
  async findAll(filters = {}, pagination = { page: 1, limit: 50 }) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('customer_events')
      .select('*, customer:users!customer_id(id,first_name,last_name,email), product:products!product_id(name), category:product_categories!category_id(name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.customer_id) query = query.eq('customer_id', filters.customer_id);
    if (filters.event_type) query = query.eq('event_type', filters.event_type);
    if (filters.product_id) query = query.eq('product_id', filters.product_id);
    if (filters.fromDate) query = query.gte('created_at', filters.fromDate);
    if (filters.toDate) query = query.lte('created_at', filters.toDate);

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return { events: data || [], total: count || 0, page: Number(page), limit: Number(limit) };
  }

  async create(event) {
    const { data, error } = await supabase
      .from('customer_events')
      .insert([event])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getHeatmap(productId, from, to) {
    const { data, error } = await supabase
      .from('customer_events')
      .select('event_type, created_at, product_id, category_id')
      .eq('product_id', productId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getTopProducts(from, to, limit = 10) {
    const { data, error } = await supabase
      .from('customer_events')
      .select('product_id, product:products!product_id(name,primary_image_url)', { count: 'exact' })
      .eq('event_type', 'product_view')
      .gte('created_at', from)
      .lte('created_at', to);

    if (error) throw error;

    const counts = new Map();
    for (const row of (data || [])) {
      const pid = row.product_id;
      counts.set(pid, { product_id: pid, views: (counts.get(pid)?.views || 0) + 1, name: row.product?.name, image: row.product?.primary_image_url });
    }
    return [...counts.values()].sort((a, b) => b.views - a.views).slice(0, limit);
  }
}

module.exports = new CustomerEventModel();
