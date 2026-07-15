const supabase = require('../config/supabase');

class CmsPageModel {
  async findAll(filters = {}) {
    let query = supabase.from('cms_pages').select('*');
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async findBySlug(slug, { publishedOnly = false } = {}) {
    let query = supabase.from('cms_pages').select('*').eq('slug', slug);
    if (publishedOnly) query = query.eq('status', 'published');

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase.from('cms_pages').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async create(data) {
    const { data: row, error } = await supabase.from('cms_pages').insert([data]).select().single();
    if (error) throw error;
    return row;
  }

  async update(id, data) {
    const { data: row, error } = await supabase
      .from('cms_pages')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async delete(id) {
    const { error } = await supabase.from('cms_pages').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

module.exports = new CmsPageModel();
