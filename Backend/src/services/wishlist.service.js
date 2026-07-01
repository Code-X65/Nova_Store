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

  async mergeWishlists(userId, productIds = []) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return await this.getOrCreateWishlist(userId);
    }
    const wishlist = await this.getOrCreateWishlist(userId);
    for (const productId of productIds) {
      const exists = await WishlistModel.checkItem(wishlist.id, productId);
      if (!exists) {
        await WishlistModel.addItem(wishlist.id, productId).catch(() => {});
      }
    }
    return await WishlistModel.findByUserId(userId);
  }

  async moveItemToCart(userId, productId, variantId = null) {
    // 1. Add item to user's cart (quantity 1)
    const CartService = require('./cart.service');
    await CartService.addItem(userId, null, productId, variantId, 1);

    // 2. Remove from wishlist
    await this.removeFromWishlist(userId, productId);

    return await WishlistModel.findByUserId(userId);
  }

  async moveAllToCart(userId) {
    const wishlist = await this.getOrCreateWishlist(userId);
    const items = wishlist.items || [];
    if (items.length === 0) return wishlist;

    const CartService = require('./cart.service');
    for (const item of items) {
      try {
        await CartService.addItem(userId, null, item.product_id, null, 1);
        await WishlistModel.removeItem(wishlist.id, item.product_id);
      } catch (err) {
        console.error(`[WishlistService] Failed to move product ${item.product_id} to cart: ${err.message}`);
      }
    }

    return await WishlistModel.findByUserId(userId);
  }
}

module.exports = new WishlistService();
