const CartModel = require('../models/cart.model');
const CartItemModel = require('../models/cart-item.model');
const ProductModel = require('../models/product.model');

class CartService {
  async getOrCreateCart(userId, sessionId) {
    let cart;
    if (userId) {
      cart = await CartModel.findByUserId(userId);
    } else if (sessionId) {
      cart = await CartModel.findBySessionId(sessionId);
    }

    if (!cart) {
      cart = await CartModel.create({
        user_id: userId || null,
        session_id: userId ? null : sessionId
      });
      cart.items = [];
    }
    
    return this.formatCartResponse(cart);
  }

  async addItem(userId, sessionId, productId, variantId, quantity) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    
    // Validate product existence and stock
    const product = await ProductModel.findById(productId);
    if (!product) throw new Error('Product not found');

    // Effective available quantity = stock minus already-reserved units
    const reserved = product.reserved_quantity || 0;
    const available = (product.stock_quantity || 0) - reserved;

    const canBackorder = !!product.allow_backorder;

    if (!canBackorder && quantity > available) {
      throw new Error(
        `Insufficient stock for "${product.name}". Available: ${available}, requested: ${quantity}`
      );
    }

    // Always refresh unit_price to the product's live price
    const unitPrice = product.sale_price || product.price;

    const existingItem = await CartItemModel.findExisting(cart.id, productId, variantId);

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (!canBackorder && newQty > available) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${available}, cart total would be: ${newQty}`
        );
      }
      await CartItemModel.update(existingItem.id, {
        quantity: newQty,
        unit_price: unitPrice
      });
    } else {
      await CartItemModel.create({
        cart_id: cart.id,
        product_id: productId,
        variant_id: variantId,
        quantity,
        unit_price: unitPrice
      });
    }

    return await this.getOrCreateCart(userId, sessionId);
  }

  async updateItemQuantity(cartItemId, quantity) {
    if (quantity <= 0) {
      return await CartItemModel.delete(cartItemId);
    }

    const cartItem = await CartItemModel.findById(cartItemId);
    if (!cartItem) throw new Error('Cart item not found');

    const product = await ProductModel.findById(cartItem.product_id);
    if (!product) throw new Error('Product not found');

    const reserved = product.reserved_quantity || 0;
    const available = (product.stock_quantity || 0) - reserved;
    const canBackorder = !!product.allow_backorder;

    if (!canBackorder && quantity > available) {
      throw new Error(
        `Insufficient stock for "${product.name}". Available: ${available}, requested: ${quantity}`
      );
    }

    const unitPrice = product.sale_price || product.price;

    return await CartItemModel.update(cartItemId, {
      quantity,
      unit_price: unitPrice
    });
  }

  async removeItem(cartItemId) {
    return await CartItemModel.delete(cartItemId);
  }

  async clearCart(userId, sessionId) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    return await CartItemModel.deleteByCartId(cart.id);
  }

  async mergeCarts(userId, sessionId) {
    const guestCart = await CartModel.findBySessionId(sessionId);
    if (!guestCart || !guestCart.items || guestCart.items.length === 0) {
      return await this.getOrCreateCart(userId, null);
    }

    const userCart = await this.getOrCreateCart(userId, null);

    for (const item of guestCart.items) {
      const existing = await CartItemModel.findExisting(userCart.id, item.product_id, item.variant_id);
      if (existing) {
        await CartItemModel.update(existing.id, {
          quantity: existing.quantity + item.quantity,
          unit_price: item.unit_price
        });
      } else {
        await CartItemModel.create({
          cart_id: userCart.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        });
      }
    }

    // Delete guest cart
    await CartModel.delete(guestCart.id);

    return await this.getOrCreateCart(userId, null);
  }

  formatCartResponse(cart) {
    const items = (cart.items || []).map(item => ({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      product: item.product,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: parseFloat((item.quantity * item.unit_price).toFixed(2))
    }));

    const subtotal = items.reduce((acc, item) => acc + item.total, 0);
    const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

    return {
      id: cart.id,
      userId: cart.user_id,
      sessionId: cart.session_id,
      items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      itemCount
    };
  }
}

module.exports = new CartService();
