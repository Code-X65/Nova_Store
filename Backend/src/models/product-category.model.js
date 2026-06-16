const supabase = require('../config/supabase');

class ProductCategoryModel {
  async findAll(options = {}) {
    let query = supabase
      .from('product_categories')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (options.activeOnly) query = query.eq('is_active', true);
    if (options.parentId !== undefined) {
      if (options.parentId === null) query = query.is('parent_id', null);
      else query = query.eq('parent_id', options.parentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*, parent:parent_id(*)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findBySlug(slug) {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*, parent:parent_id(*)')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByParentSlug(parentSlug) {
    const parent = await this.findBySlug(parentSlug);
    if (!parent) return [];
    return this.findAll({ parentId: parent.id, activeOnly: true });
  }

  async create(categoryData) {
    const { data, error } = await supabase
      .from('product_categories')
      .insert([categoryData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(categoriesData) {
    const { data, error } = await supabase
      .from('product_categories')
      .insert(categoriesData)
      .select();

    if (error) throw error;
    return data;
  }

  async update(id, updateData) {
    const { parentId, ...rest } = updateData;
    const mappedUpdate = { ...rest };
    if (parentId !== undefined) {
      mappedUpdate.parent_id = parentId;
    }

    const { data, error } = await supabase
      .from('product_categories')
      .update({ ...mappedUpdate, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async softDelete(id) {
    const { error } = await supabase
      .from('product_categories')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

module.exports = new ProductCategoryModel();
