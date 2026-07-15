const supabase = require('../config/supabase');

class CmsBannerModel {
  async findAll(filters = {}) {
    let query = supabase.from('cms_banners').select('*');
    if (filters.position) query = query.eq('position', filters.position);
    if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive);

    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  }

  async findActive(position = null) {
    const now = new Date().toISOString();
    let query = supabase
      .from('cms_banners')
      .select('*')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`);

    if (position) query = query.eq('position', position);

    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase.from('cms_banners').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async create(data) {
    const { data: row, error } = await supabase.from('cms_banners').insert([data]).select().single();
    if (error) throw error;
    return row;
  }

  async update(id, data) {
    const { data: row, error } = await supabase
      .from('cms_banners')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async delete(id) {
    const { error } = await supabase.from('cms_banners').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

module.exports = new CmsBannerModel();
