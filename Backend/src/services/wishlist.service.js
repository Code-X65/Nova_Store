const WishlistModel = require('../models/wishlist.model');

class WishlistService {
  async getOrCreateWishlist(userId, storeId = null) {
    let wishlist = await WishlistModel.findByUserId(userId, storeId);
    if (!wishlist) {
      wishlist = await WishlistModel.create(userId, storeId);
      wishlist.items = [];
    }
    return wishlist;
  }

  async addToWishlist(userId, productId, storeId = null) {
    const wishlist = await this.getOrCreateWishlist(userId, storeId);
    const exists = await WishlistModel.checkItem(wishlist.id, productId);
    if (exists) return wishlist;

    await WishlistModel.addItem(wishlist.id, productId);
    return await WishlistModel.findByUserId(userId, storeId);
  }

  async removeFromWishlist(userId, productId, storeId = null) {
    const wishlist = await this.getOrCreateWishlist(userId, storeId);
    await WishlistModel.removeItem(wishlist.id, productId);
    return await WishlistModel.findByUserId(userId, storeId);
  }

  async isInWishlist(userId, productId, storeId = null) {
    const wishlist = await this.getOrCreateWishlist(userId, storeId);
    const inWishlist = await WishlistModel.checkItem(wishlist.id, productId);
    return { inWishlist };
  }

  async mergeWishlists(userId, productIds = [], storeId = null) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return await this.getOrCreateWishlist(userId, storeId);
    }
    const wishlist = await this.getOrCreateWishlist(userId, storeId);
    for (const productId of productIds) {
      const exists = await WishlistModel.checkItem(wishlist.id, productId);
      if (!exists) {
        await WishlistModel.addItem(wishlist.id, productId).catch(() => {});
      }
    }
    return await WishlistModel.findByUserId(userId, storeId);
  }

  async moveItemToCart(userId, productId, variantId = null, storeId = null) {
    // 1. Add item to user's cart (quantity 1)
    const CartService = require('./cart.service');
    await CartService.addItem(userId, null, productId, variantId, 1, storeId);

    // 2. Remove from wishlist
    await this.removeFromWishlist(userId, productId, storeId);

    return await WishlistModel.findByUserId(userId, storeId);
  }

  async moveAllToCart(userId, storeId = null) {
    const wishlist = await this.getOrCreateWishlist(userId, storeId);
    const items = wishlist.items || [];
    if (items.length === 0) return wishlist;

    const CartService = require('./cart.service');
    for (const item of items) {
      try {
        await CartService.addItem(userId, null, item.product_id, null, 1, storeId);
        await WishlistModel.removeItem(wishlist.id, item.product_id);
      } catch (err) {
        console.error(`[WishlistService] Failed to move product ${item.product_id} to cart: ${err.message}`);
      }
    }

    return await WishlistModel.findByUserId(userId, storeId);
  }
}

module.exports = new WishlistService();
