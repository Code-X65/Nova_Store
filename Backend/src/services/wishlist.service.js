const WishlistModel = require('../models/wishlist.model');

class WishlistService {
  async getOrCreateWishlist(userId) {
    let wishlist = await WishlistModel.findByUserId(userId);
    if (!wishlist) {
      wishlist = await WishlistModel.create(userId);
      wishlist.items = [];
    }
    return wishlist;
  }

  async addToWishlist(userId, productId) {
    const wishlist = await this.getOrCreateWishlist(userId);
    const exists = await WishlistModel.checkItem(wishlist.id, productId);
    if (exists) return wishlist;

    await WishlistModel.addItem(wishlist.id, productId);
    return await WishlistModel.findByUserId(userId);
  }

  async removeFromWishlist(userId, productId) {
    const wishlist = await this.getOrCreateWishlist(userId);
    await WishlistModel.removeItem(wishlist.id, productId);
    return await WishlistModel.findByUserId(userId);
  }

  async isInWishlist(userId, productId) {
    const wishlist = await this.getOrCreateWishlist(userId);
    const inWishlist = await WishlistModel.checkItem(wishlist.id, productId);
    return { inWishlist };
  }
}

module.exports = new WishlistService();
