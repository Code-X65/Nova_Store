const CartService = require('../../../src/services/cart.service');
const CartModel = require('../../../src/models/cart.model');
const CartItemModel = require('../../../src/models/cart-item.model');
const ProductModel = require('../../../src/models/product.model');

jest.mock('../../../src/models/cart.model');
jest.mock('../../../src/models/cart-item.model');
jest.mock('../../../src/models/product.model');

describe('CartService', () => {
  const mockProduct = {
    id: 'prod-uuid-1',
    name: 'Sample Product',
    price: 1000.00,
    stock_quantity: 10,
    track_inventory: true,
    allow_backorder: false,
    variants: [
      {
        id: 'var-uuid-1',
        name: 'Red / Small',
        price_modifier: 100.00,
        stock_quantity: 3,
        track_inventory: true
      }
    ]
  };

  const mockCart = {
    id: 'cart-uuid-1',
    user_id: 'user-uuid-1',
    session_id: null,
    items: []
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addItem', () => {
    it('should add item successfully if stock is available', async () => {
      CartModel.findByUserId.mockResolvedValue(mockCart);
      ProductModel.findById.mockResolvedValue(mockProduct);
      CartItemModel.findExisting.mockResolvedValue(null);
      CartItemModel.create.mockResolvedValue({});

      const result = await CartService.addItem('user-uuid-1', null, 'prod-uuid-1', null, 5);
      expect(CartItemModel.create).toHaveBeenCalledWith({
        cart_id: 'cart-uuid-1',
        product_id: 'prod-uuid-1',
        variant_id: null,
        quantity: 5,
        unit_price: 1000.00
      });
    });

    it('should throw error if stock is insufficient', async () => {
      CartModel.findByUserId.mockResolvedValue(mockCart);
      ProductModel.findById.mockResolvedValue(mockProduct);

      await expect(
        CartService.addItem('user-uuid-1', null, 'prod-uuid-1', null, 15)
      ).rejects.toThrow('Insufficient stock for "Sample Product". Available: 10, requested: 15');
    });

    it('should check variant stock if variantId is provided', async () => {
      CartModel.findByUserId.mockResolvedValue(mockCart);
      ProductModel.findById.mockResolvedValue(mockProduct);
      CartItemModel.findExisting.mockResolvedValue(null);
      CartItemModel.create.mockResolvedValue({});

      const result = await CartService.addItem('user-uuid-1', null, 'prod-uuid-1', 'var-uuid-1', 2);
      expect(CartItemModel.create).toHaveBeenCalledWith({
        cart_id: 'cart-uuid-1',
        product_id: 'prod-uuid-1',
        variant_id: 'var-uuid-1',
        quantity: 2,
        unit_price: 1100.00 // base price + price_modifier
      });
    });

    it('should throw variant stock error if variant stock is insufficient', async () => {
      CartModel.findByUserId.mockResolvedValue(mockCart);
      ProductModel.findById.mockResolvedValue(mockProduct);

      await expect(
        CartService.addItem('user-uuid-1', null, 'prod-uuid-1', 'var-uuid-1', 4)
      ).rejects.toThrow('Insufficient stock for "Sample Product - Red / Small". Available: 3, requested: 4');
    });
  });

  describe('updateItemQuantity', () => {
    it('should update item quantity successfully if stock is available', async () => {
      const cartItem = { id: 'item-1', product_id: 'prod-uuid-1', variant_id: null, quantity: 2 };
      CartItemModel.findById.mockResolvedValue(cartItem);
      ProductModel.findById.mockResolvedValue(mockProduct);
      CartItemModel.update.mockResolvedValue({});

      await CartService.updateItemQuantity('item-1', 8);
      expect(CartItemModel.update).toHaveBeenCalledWith('item-1', {
        quantity: 8,
        unit_price: 1000.00
      });
    });

    it('should throw error if updated quantity exceeds stock', async () => {
      const cartItem = { id: 'item-1', product_id: 'prod-uuid-1', variant_id: null, quantity: 2 };
      CartItemModel.findById.mockResolvedValue(cartItem);
      ProductModel.findById.mockResolvedValue(mockProduct);

      await expect(
        CartService.updateItemQuantity('item-1', 12)
      ).rejects.toThrow('Insufficient stock');
    });
  });

  describe('mergeCarts', () => {
    it('should merge guest cart and user cart successfully if stock permits', async () => {
      const guestCart = {
        id: 'guest-cart-uuid',
        session_id: 'session-123',
        items: [
          { product_id: 'prod-uuid-1', variant_id: null, quantity: 3, unit_price: 1000.00 }
        ]
      };
      const userCart = {
        id: 'user-cart-uuid',
        user_id: 'user-uuid-1',
        items: []
      };

      CartModel.findBySessionId.mockResolvedValue(guestCart);
      CartModel.findByUserId.mockResolvedValue(userCart);
      ProductModel.findById.mockResolvedValue(mockProduct);
      CartItemModel.findExisting.mockResolvedValue(null);
      CartItemModel.create.mockResolvedValue({});
      CartModel.delete.mockResolvedValue({});

      await CartService.mergeCarts('user-uuid-1', 'session-123');

      expect(CartItemModel.create).toHaveBeenCalledWith({
        cart_id: 'user-cart-uuid',
        product_id: 'prod-uuid-1',
        variant_id: null,
        quantity: 3,
        unit_price: 1000.00
      });
      expect(CartModel.delete).toHaveBeenCalledWith('guest-cart-uuid');
    });

    it('should throw stock error during merge if combined quantity exceeds stock', async () => {
      const guestCart = {
        id: 'guest-cart-uuid',
        session_id: 'session-123',
        items: [
          { product_id: 'prod-uuid-1', variant_id: null, quantity: 6, unit_price: 1000.00 }
        ]
      };
      const userCart = {
        id: 'user-cart-uuid',
        user_id: 'user-uuid-1',
        items: []
      };
      const existingUserItem = {
        id: 'user-item-1',
        product_id: 'prod-uuid-1',
        variant_id: null,
        quantity: 5, // user already has 5 in cart
        unit_price: 1000.00
      };

      CartModel.findBySessionId.mockResolvedValue(guestCart);
      CartModel.findByUserId.mockResolvedValue(userCart);
      ProductModel.findById.mockResolvedValue(mockProduct);
      // First call inside stock check check loop finds existing item
      CartItemModel.findExisting.mockResolvedValue(existingUserItem);

      // The merge attempts to add 6 on top of existing 5 = 11, exceeding product stock of 10.
      await expect(
        CartService.mergeCarts('user-uuid-1', 'session-123')
      ).rejects.toThrow('Insufficient stock for "Sample Product". Available: 10, requested: 11');

      // Verify that no database updates or insertions occurred
      expect(CartItemModel.update).not.toHaveBeenCalled();
      expect(CartItemModel.create).not.toHaveBeenCalled();
    });
  });
});
