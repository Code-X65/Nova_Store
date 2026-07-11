const supabase = require('../config/supabase');

class ProductVariantModel {
  async findById(id) {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByProductId(productId) {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId);

    if (error) throw error;
    return data;
  }

  async create(variantData) {
    if (!variantData.sku) {
      variantData.sku = 'VAR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    const { data, error } = await supabase
      .from('product_variants')
      .insert([variantData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createBulk(variants) {
    variants.forEach(v => {
      if (!v.sku) v.sku = 'VAR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    });
    const { data, error } = await supabase
      .from('product_variants')
      .insert(variants)
      .select();

    if (error) throw error;
    return data;
  }

  async update(id, updateData) {
    if (updateData.sku === '') {
      updateData.sku = 'VAR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    const { data, error } = await supabase
      .from('product_variants')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

module.exports = new ProductVariantModel();
