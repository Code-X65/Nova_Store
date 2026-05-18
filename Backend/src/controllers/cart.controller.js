const CartService = require('../services/cart.service');

class CartController {
  async getCart(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || req.query.sessionId;
      
      const cart = await CartService.getOrCreateCart(userId, sessionId);
      res.status(200).json({ success: true, data: { cart } });
    } catch (error) {
      next(error);
    }
  }

  async addToCart(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || req.body.sessionId;
      const { productId, variantId, quantity } = req.body;

      if (!productId || !quantity) {
        return res.status(400).json({ success: false, message: 'Product ID and quantity are required' });
      }

      const cart = await CartService.addItem(userId, sessionId, productId, variantId, quantity);
      res.status(200).json({ success: true, data: { cart } });
    } catch (error) {
      next(error);
    }
  }

  async updateItemQuantity(req, res, next) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (quantity === undefined) {
        return res.status(400).json({ success: false, message: 'Quantity is required' });
      }

      await CartService.updateItemQuantity(id, quantity);
      
      // Return updated cart
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || req.query.sessionId;
      const cart = await CartService.getOrCreateCart(userId, sessionId);
      
      res.status(200).json({ success: true, data: { cart } });
    } catch (error) {
      next(error);
    }
  }

  async removeItem(req, res, next) {
    try {
      const { id } = req.params;
      await CartService.removeItem(id);
      
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || req.query.sessionId;
      const cart = await CartService.getOrCreateCart(userId, sessionId);
      
      res.status(200).json({ success: true, data: { cart } });
    } catch (error) {
      next(error);
    }
  }

  async clearCart(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || req.query.sessionId;
      
      await CartService.clearCart(userId, sessionId);
      res.status(200).json({ success: true, message: 'Cart cleared' });
    } catch (error) {
      next(error);
    }
  }

  async mergeCart(req, res, next) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ success: false, message: 'Session ID is required for merge' });
      }

      const cart = await CartService.mergeCarts(userId, sessionId);
      res.status(200).json({ success: true, data: { cart }, message: 'Carts merged successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CartController();
