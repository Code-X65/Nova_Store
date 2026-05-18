const supabase = require('../config/supabase');

class CartModel {
  async findByUserId(userId) {
    const { data, error } = await supabase
      .from('carts')
      .select('*, items:cart_items(*, product:products(*), variant:product_variants(*))')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findBySessionId(sessionId) {
    const { data, error } = await supabase
      .from('carts')
      .select('*, items:cart_items(*, product:products(*), variant:product_variants(*))')
      .eq('session_id', sessionId)
      .maybeSingle();

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
}

module.exports = new CartModel();
