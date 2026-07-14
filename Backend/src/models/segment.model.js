const supabase = require('../config/supabase');

class SegmentModel {
  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('segments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters.search) query = query.ilike('name', `%${filters.search}%`);

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return { segments: data || [], total: count || 0, page: Number(page), limit: Number(limit) };
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async create(segment) {
    const { data, error } = await supabase
      .from('segments')
      .insert([segment])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id, updates) {
    const { data, error } = await supabase
      .from('segments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async remove(id) {
    const { error } = await supabase
      .from('segments')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
}

module.exports = new SegmentModel();
