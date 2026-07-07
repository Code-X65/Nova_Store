const supabase = require('../config/supabase');

class ProductBrandModel {
  async findAll(options = {}) {
    let query = supabase
      .from('product_brands')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (options.store_id) query = query.eq('store_id', options.store_id);
    if (options.featuredOnly) query = query.eq('is_featured', true);
    if (options.activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async findById(id, storeId = null) {
    let query = supabase
      .from('product_brands')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null);

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findBySlug(slug, storeId = null) {
    let query = supabase
      .from('product_brands')
      .select('*')
      .eq('slug', slug)
      .is('deleted_at', null);

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async create(brandData) {
    const { data, error } = await supabase
      .from('product_brands')
      .insert([brandData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updateData, storeId = null) {
    let query = supabase
      .from('product_brands')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  }

  async softDelete(id, storeId = null) {
    let query = supabase
      .from('product_brands')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id);

    if (storeId) query = query.eq('store_id', storeId);

    const { error } = await query;
    if (error) throw error;
    return true;
  }
}

module.exports = new ProductBrandModel();
