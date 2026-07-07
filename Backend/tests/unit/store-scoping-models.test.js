const userModel = require('../../src/models/user.model');
const productModel = require('../../src/models/product.model');
const categoryModel = require('../../src/models/product-category.model');
const brandModel = require('../../src/models/product-brand.model');
const orderModel = require('../../src/models/order.model');
const cartModel = require('../../src/models/cart.model');
const wishlistModel = require('../../src/models/wishlist.model');
const inventoryService = require('../../src/services/inventory.service');
const supabase = require('../../src/config/supabase');

// Mock Supabase globally
jest.mock('../../src/config/supabase', () => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    then: function(resolve) {
      resolve({ data: this._data || [], error: this._error || null });
    }
  };

  const client = {
    from: jest.fn().mockReturnValue(queryBuilder),
    rpc: jest.fn().mockReturnValue(queryBuilder),
    auth: {}
  };
  client.supabaseAdmin = client;
  return client;
});

describe('Phase 2 Store Scoping Model Unit Tests', () => {
  let mockQuery;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = supabase.from();
    supabase.from.mockReturnValue(mockQuery);
    supabase.rpc.mockReturnValue(mockQuery);

    mockQuery.single.mockResolvedValue({ data: { id: 'test-id', store_id: 'store-123' }, error: null });
    mockQuery.maybeSingle.mockResolvedValue({ data: { id: 'test-id', store_id: 'store-123' }, error: null });
    mockQuery._data = [];
    mockQuery._error = null;
  });

  describe('UserModel scoping', () => {
    it('findAll should filter by store_id if provided', async () => {
      mockQuery.range.mockReturnThis();
      mockQuery.order.mockReturnThis();
      await userModel.findAll(1, 10, { store_id: 'store-123' });
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('findAdmins should filter by storeId if provided', async () => {
      mockQuery.in.mockReturnThis();
      mockQuery.order.mockReturnThis();
      mockQuery.range.mockReturnThis();
      await userModel.findAdmins({ storeId: 'store-123' });
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });
  });

  describe('ProductModel scoping', () => {
    it('findAll standard path should filter by store_id', async () => {
      mockQuery.is.mockReturnThis();
      mockQuery.order.mockReturnThis();
      mockQuery.range.mockReturnThis();
      await productModel.findAll({ store_id: 'store-123' });
      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('findById should filter by storeId', async () => {
      mockQuery.is.mockReturnThis();
      await productModel.findById('prod-1', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('findBySlug should filter by storeId', async () => {
      mockQuery.is.mockReturnThis();
      await productModel.findBySlug('prod-slug', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('getFeatured should filter by storeId', async () => {
      mockQuery.eq.mockReturnThis();
      mockQuery.is.mockReturnThis();
      mockQuery.order.mockReturnThis();
      await productModel.getFeatured(10, 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('getLowStockProducts should query get_low_stock_products and filter by store_id', async () => {
      await productModel.getLowStockProducts('store-123');
      expect(supabase.rpc).toHaveBeenCalledWith('get_low_stock_products');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('search should query search_products and filter by store_id', async () => {
      await productModel.search('query', 10, 'store-123');
      expect(supabase.rpc).toHaveBeenCalledWith('search_products', { search_query: 'query', lim: 10 });
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('getPriceRange should filter by store_id', async () => {
      mockQuery.is.mockReturnThis();
      await productModel.getPriceRange({ store_id: 'store-123' });
      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });
  });

  describe('ProductCategoryModel scoping', () => {
    it('findAll should filter by store_id', async () => {
      mockQuery.is.mockReturnThis();
      mockQuery.order.mockReturnThis();
      await categoryModel.findAll({ store_id: 'store-123' });
      expect(supabase.from).toHaveBeenCalledWith('product_categories');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('findById should filter by storeId', async () => {
      mockQuery.is.mockReturnThis();
      await categoryModel.findById('cat-1', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('product_categories');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });
  });

  describe('ProductBrandModel scoping', () => {
    it('findAll should filter by store_id', async () => {
      mockQuery.is.mockReturnThis();
      mockQuery.order.mockReturnThis();
      await brandModel.findAll({ store_id: 'store-123' });
      expect(supabase.from).toHaveBeenCalledWith('product_brands');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('findById should filter by storeId', async () => {
      mockQuery.is.mockReturnThis();
      await brandModel.findById('brand-1', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('product_brands');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });
  });

  describe('OrderModel scoping', () => {
    it('findById should filter by storeId', async () => {
      await orderModel.findById('order-1', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('orders');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('findByOrderNumber should filter by storeId', async () => {
      await orderModel.findByOrderNumber('ORD-123', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('orders');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('findByUserId should filter by store_id', async () => {
      mockQuery.range.mockReturnThis();
      await orderModel.findByUserId('user-1', { store_id: 'store-123' });
      expect(supabase.from).toHaveBeenCalledWith('orders');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('findAll should filter by store_id', async () => {
      mockQuery.range.mockReturnThis();
      await orderModel.findAll({ store_id: 'store-123' });
      expect(supabase.from).toHaveBeenCalledWith('orders');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });
  });

  describe('CartModel scoping', () => {
    it('findByUserId should filter by store_id', async () => {
      await cartModel.findByUserId('user-1', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('carts');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('findBySessionId should filter by store_id', async () => {
      await cartModel.findBySessionId('sess-1', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('carts');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });
  });

  describe('WishlistModel scoping', () => {
    it('findByUserId should filter by store_id', async () => {
      await wishlistModel.findByUserId('user-1', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('wishlists');
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', 'store-123');
    });

    it('create should insert store_id', async () => {
      await wishlistModel.create('user-1', 'store-123');
      expect(supabase.from).toHaveBeenCalledWith('wishlists');
      expect(mockQuery.insert).toHaveBeenCalledWith([{ user_id: 'user-1', store_id: 'store-123' }]);
    });
  });

  describe('InventoryService scoping', () => {
    it('getLowStockItems should pass storeId to ProductModel', async () => {
      const getLowStockSpy = jest.spyOn(productModel, 'getLowStockProducts').mockResolvedValue([]);
      await inventoryService.getLowStockItems('store-123');
      expect(getLowStockSpy).toHaveBeenCalledWith('store-123');
      getLowStockSpy.mockRestore();
    });
  });
});
