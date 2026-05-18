const supabase = require('../config/supabase');

class WishlistModel {
  async findByUserId(userId) {
    const { data, error } = await supabase
      .from('wishlists')
      .select('*, items:wishlist_items(*, product:products(*))')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(userId) {
    const { data, error } = await supabase
      .from('wishlists')
      .insert([{ user_id: userId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addItem(wishlistId, productId) {
    const { data, error } = await supabase
      .from('wishlist_items')
      .insert([{ wishlist_id: wishlistId, product_id: productId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeItem(wishlistId, productId) {
    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('wishlist_id', wishlistId)
      .eq('product_id', productId);

    if (error) throw error;
    return true;
  }

  async checkItem(wishlistId, productId) {
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('id')
      .eq('wishlist_id', wishlistId)
      .eq('product_id', productId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }
}

module.exports = new WishlistModel();
