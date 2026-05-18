const supabase = require('../config/supabase');

class CartItemModel {
  async create(itemData) {
    const { data, error } = await supabase
      .from('cart_items')
      .insert([itemData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('cart_items')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async deleteByCartId(cartId) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId);

    if (error) throw error;
    return true;
  }

  async findExisting(cartId, productId, variantId = null) {
    let query = supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', cartId)
      .eq('product_id', productId);

    if (variantId) {
      query = query.eq('variant_id', variantId);
    } else {
      query = query.is('variant_id', null);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }
}

module.exports = new CartItemModel();
