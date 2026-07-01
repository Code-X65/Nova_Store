const WishlistService = require('../services/wishlist.service');

class WishlistController {
  async getWishlist(req, res, next) {
    try {
      const wishlist = await WishlistService.getOrCreateWishlist(req.user.id);
      res.status(200).json({ success: true, data: { wishlist } });
    } catch (error) {
      next(error);
    }
  }

  async addToWishlist(req, res, next) {
    try {
      const { productId } = req.body;
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product ID is required' });
      }

      const wishlist = await WishlistService.addToWishlist(req.user.id, productId);
      res.status(201).json({ success: true, data: { wishlist }, message: 'Added to wishlist' });
    } catch (error) {
      next(error);
    }
  }

  async removeFromWishlist(req, res, next) {
    try {
      const { productId } = req.params;
      const wishlist = await WishlistService.removeFromWishlist(req.user.id, productId);
      res.status(200).json({ success: true, data: { wishlist }, message: 'Removed from wishlist' });
    } catch (error) {
      next(error);
    }
  }

  async checkInWishlist(req, res, next) {
    try {
      const { productId } = req.params;
      const result = await WishlistService.isInWishlist(req.user.id, productId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async mergeWishlist(req, res, next) {
    try {
      const { productIds } = req.body;
      const wishlist = await WishlistService.mergeWishlists(req.user.id, productIds);
      res.status(200).json({ success: true, data: { wishlist }, message: 'Wishlists merged successfully' });
    } catch (error) {
      next(error);
    }
  }

  async moveItemToCart(req, res, next) {
    try {
      const { productId, variantId } = req.body;
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product ID is required' });
      }
      const wishlist = await WishlistService.moveItemToCart(req.user.id, productId, variantId);
      res.status(200).json({ success: true, data: { wishlist }, message: 'Item moved to cart' });
    } catch (error) {
      next(error);
    }
  }

  async moveAllToCart(req, res, next) {
    try {
      const wishlist = await WishlistService.moveAllToCart(req.user.id);
      res.status(200).json({ success: true, data: { wishlist }, message: 'All items moved to cart' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WishlistController();
