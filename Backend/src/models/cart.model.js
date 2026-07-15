const supabase = require('../config/supabase');

class CartModel {
  async findByUserId(userId, storeId = null) {
    let query = supabase
      .from('carts')
      .select('*, items:cart_items(*, product:products(*), variant:product_variants(*))')
      .eq('user_id', userId);

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data;
  }

  async findBySessionId(sessionId, storeId = null) {
    let query = supabase
      .from('carts')
      .select('*, items:cart_items(*, product:products(*), variant:product_variants(*))')
      .eq('session_id', sessionId);

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(cartData) {
    const { data, error } = await supabase
      .from('carts')
      .insert([cartData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('carts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async touch(id) {
    const { error } = await supabase
      .from('carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

module.exports = new CartModel();
