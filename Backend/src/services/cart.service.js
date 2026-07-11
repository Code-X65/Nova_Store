const CartModel = require('../models/cart.model');
const CartItemModel = require('../models/cart-item.model');
const ProductModel = require('../models/product.model');
const { SINGLE_STORE_ID } = require('../config/store');

class CartService {
  async getOrCreateCart(userId, sessionId) {
    let cart;
    if (userId) {
      cart = await CartModel.findByUserId(userId, SINGLE_STORE_ID);
    } else if (sessionId) {
      cart = await CartModel.findBySessionId(sessionId, SINGLE_STORE_ID);
    }

    if (!cart) {
      cart = await CartModel.create({
        user_id: userId || null,
        session_id: userId ? null : sessionId,
        store_id: SINGLE_STORE_ID
      });
      cart.items = [];
    }
    
    return this.formatCartResponse(cart);
  }

  async addItem(userId, sessionId, productId, variantId, quantity) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    
    // Validate product existence and stock
    const product = await ProductModel.findById(productId, SINGLE_STORE_ID);
    if (!product) throw new Error('Product not found');

    const existingItem = await CartItemModel.findExisting(cart.id, productId, variantId);
    const targetQty = existingItem ? (existingItem.quantity + quantity) : quantity;

    this.verifyStockAvailability(product, variantId, targetQty);

    // Always refresh unit_price to the product's live price (with variant overrides)
    let unitPrice = product.sale_price || product.price;
    if (variantId) {
      const variant = (product.variants || []).find(v => v.id === variantId);
      if (variant) {
        if (variant.sale_price) {
          unitPrice = variant.sale_price;
        } else if (variant.price_modifier) {
          unitPrice = Number(product.sale_price || product.price) + Number(variant.price_modifier);
        }
      }
    }

    if (existingItem) {
      await CartItemModel.update(existingItem.id, {
        quantity: targetQty,
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

    const product = await ProductModel.findById(cartItem.product_id, SINGLE_STORE_ID);
    if (!product) throw new Error('Product not found');

    this.verifyStockAvailability(product, cartItem.variant_id, quantity);

    let unitPrice = product.sale_price || product.price;
    if (cartItem.variant_id) {
      const variant = (product.variants || []).find(v => v.id === cartItem.variant_id);
      if (variant) {
        if (variant.sale_price) {
          unitPrice = variant.sale_price;
        } else if (variant.price_modifier) {
          unitPrice = Number(product.sale_price || product.price) + Number(variant.price_modifier);
        }
      }
    }

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
    const guestCart = await CartModel.findBySessionId(sessionId, SINGLE_STORE_ID);
    if (!guestCart || !guestCart.items || guestCart.items.length === 0) {
      return await this.getOrCreateCart(userId, null);
    }

    const userCart = await this.getOrCreateCart(userId, null);

    // 1. Validate stock availability for all merged quantities first
    for (const item of guestCart.items) {
      const product = await ProductModel.findById(item.product_id, SINGLE_STORE_ID);
      if (!product) throw new Error('Product not found');

      const existing = await CartItemModel.findExisting(userCart.id, item.product_id, item.variant_id);
      const targetQty = existing ? (existing.quantity + item.quantity) : item.quantity;

      this.verifyStockAvailability(product, item.variant_id, targetQty);
    }

    // 2. Perform DB writes/updates if all validations pass
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

  verifyStockAvailability(product, variantId, quantity) {
    let available = 0;
    let name = product.name;
    const canBackorder = !!product.allow_backorder;

    if (variantId) {
      const variant = (product.variants || []).find(v => v.id === variantId);
      if (!variant) throw new Error('Product variant not found');

      name = `${product.name} - ${variant.name}`;
      if (variant.track_inventory === false || product.track_inventory === false) {
        available = Infinity;
      } else {
        available = variant.stock_quantity || 0;
      }
    } else {
      if (product.track_inventory === false) {
        available = Infinity;
      } else {
        const reserved = product.reserved_quantity || 0;
        available = (product.stock_quantity || 0) - reserved;
      }
    }

    if (!canBackorder && quantity > available) {
      throw new Error(
        `Insufficient stock for "${name}". Available: ${available}, requested: ${quantity}`
      );
    }
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
