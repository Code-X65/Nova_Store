const supabase = require('../config/supabase');

class ProductQuestionModel {
  async findByProductId(productId, { onlyApproved = true } = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('product_questions')
      .select('*, user:users(id,first_name,last_name)', { count: 'exact' })
      .eq('product_id', productId);

    if (onlyApproved) query = query.eq('status', 'approved');

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data, count, page, limit };
  }

  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('product_questions')
      .select('*, user:users(id,first_name,last_name,email), product:products(id,name)', { count: 'exact' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.productId) query = query.eq('product_id', filters.productId);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data, count, page, limit };
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('product_questions')
      .select('*, user:users(id,first_name,last_name), product:products(id,name)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(data) {
    const { data: row, error } = await supabase
      .from('product_questions')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return row;
  }

  async update(id, data) {
    const { data: row, error } = await supabase
      .from('product_questions')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return row;
  }

  async delete(id) {
    const { error } = await supabase.from('product_questions').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

module.exports = new ProductQuestionModel();
