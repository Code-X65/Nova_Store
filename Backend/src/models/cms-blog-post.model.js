const supabase = require('../config/supabase');

class CmsBlogPostModel {
  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from('cms_blog_posts').select('*', { count: 'exact' });
    if (filters.status) query = query.eq('status', filters.status);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { data, count, page, limit };
  }

  async findBySlug(slug, { publishedOnly = false } = {}) {
    let query = supabase.from('cms_blog_posts').select('*').eq('slug', slug);
    if (publishedOnly) query = query.eq('status', 'published');

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase.from('cms_blog_posts').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async create(data) {
    const { data: row, error } = await supabase.from('cms_blog_posts').insert([data]).select().single();
    if (error) throw error;
    return row;
  }

  async update(id, data) {
    const { data: row, error } = await supabase
      .from('cms_blog_posts')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async delete(id) {
    const { error } = await supabase.from('cms_blog_posts').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

module.exports = new CmsBlogPostModel();
