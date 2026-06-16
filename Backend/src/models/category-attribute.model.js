const { supabaseAdmin } = require('../config/supabase');

class CategoryAttributeModel {
  /**
   * Fetch all attribute templates for a single category.
   * @param {string} categoryId
   */
  async findByCategoryId(categoryId) {
    const { data, error } = await supabaseAdmin
      .from('category_attributes')
      .select('*')
      .eq('category_id', categoryId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Bulk fetch attribute templates for multiple categories.
   * Used for inheritance resolution.
   * @param {string[]} categoryIds
   */
  async findByCategoryIds(categoryIds) {
    if (!categoryIds || categoryIds.length === 0) return [];

    const { data, error } = await supabaseAdmin
      .from('category_attributes')
      .select('*')
      .in('category_id', categoryIds)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Find a single attribute template by its ID.
   * @param {string} id
   */
  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('category_attributes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Create a new attribute template for a category.
   * @param {object} attributeData
   */
  async create(attributeData) {
    const { data, error } = await supabaseAdmin
      .from('category_attributes')
      .insert([attributeData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update an attribute template.
   * @param {string} id
   * @param {object} updateData
   */
  async update(id, updateData) {
    const { data, error } = await supabaseAdmin
      .from('category_attributes')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Hard delete an attribute template. Cascades to product_attributes.
   * @param {string} id
   */
  async delete(id) {
    const { error } = await supabaseAdmin
      .from('category_attributes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

module.exports = new CategoryAttributeModel();
