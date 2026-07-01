const { supabaseAdmin } = require('../config/supabase');

class ProductAttributeModel {
  /**
   * Fetch all attribute values for a product, joined with the template
   * for name, type, unit, and display_order.
   * @param {string} productId
   */
  async findByProductId(productId) {
    const { data, error } = await supabaseAdmin
      .from('product_attributes')
      .select(`
        id,
        attribute_value,
        attribute_id,
        category_attributes (
          attribute_name,
          attribute_type,
          unit,
          display_order
        )
      `)
      .eq('product_id', productId)
      .order('category_attributes(display_order)', { ascending: true });

    if (error) throw error;

    // Flatten for convenience: [{name, value, unit, type}]
    return (data || []).map(row => ({
      attribute_id:   row.attribute_id,
      name:           row.category_attributes?.attribute_name,
      value:          row.attribute_value,
      unit:           row.category_attributes?.unit,
      type:           row.category_attributes?.attribute_type,
      display_order:  row.category_attributes?.display_order
    }));
  }

  /**
   * Upsert (insert or update) multiple attribute values for a product.
   * @param {string} productId
   * @param {{ attribute_id: string, attribute_value: string }[]} rows
   */
  async upsertBulk(productId, rows) {
    if (!rows || rows.length === 0) return [];

    const payload = rows.map(r => ({
      product_id:      productId,
      attribute_id:    r.attribute_id,
      attribute_value: r.attribute_value,
      updated_at:      new Date().toISOString()
    }));

    const { data, error } = await supabaseAdmin
      .from('product_attributes')
      .upsert(payload, { onConflict: 'product_id,attribute_id' })
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * Delete all attribute values for a product (used before full replacement).
   * @param {string} productId
   */
  async deleteByProductId(productId) {
    const { error } = await supabaseAdmin
      .from('product_attributes')
      .delete()
      .eq('product_id', productId);

    if (error) throw error;
    return true;
  }

  /**
   * Delete a single attribute value for a product.
   * @param {string} productId
   * @param {string} attributeId
   */
  async deleteProductAttribute(productId, attributeId) {
    const { error } = await supabaseAdmin
      .from('product_attributes')
      .delete()
      .eq('product_id', productId)
      .eq('attribute_id', attributeId);

    if (error) throw error;
    return true;
  }
}

module.exports = new ProductAttributeModel();
