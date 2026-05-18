const supabase = require('../config/supabase');

class ProductBrandModel {
  async findAll(options = {}) {
    let query = supabase
      .from('product_brands')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (options.featuredOnly) query = query.eq('is_featured', true);
    if (options.activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('product_brands')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

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

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('product_brands')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async softDelete(id) {
    const { error } = await supabase
      .from('product_brands')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

module.exports = new ProductBrandModel();
