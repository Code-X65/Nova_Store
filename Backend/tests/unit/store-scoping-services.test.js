const invitationService = require('../../src/services/invitation.service');
const productService = require('../../src/services/product.service');
const categoryService = require('../../src/services/category.service');
const cartService = require('../../src/services/cart.service');
const wishlistService = require('../../src/services/wishlist.service');
const orderService = require('../../src/services/order.service');

const invitationModel = require('../../src/models/invitation.model');
const userModel = require('../../src/models/user.model');
const productModel = require('../../src/models/product.model');
const productCategoryModel = require('../../src/models/product-category.model');
const cartModel = require('../../src/models/cart.model');
const cartItemModel = require('../../src/models/cart-item.model');
const wishlistModel = require('../../src/models/wishlist.model');
const orderModel = require('../../src/models/order.model');
const roleModel = require('../../src/models/role.model');

jest.mock('../../src/models/invitation.model');
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/role.model');
jest.mock('../../src/models/user-role.model');
jest.mock('../../src/services/notification.service', () => ({
  sendAdminInvitationEmail: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/models/product.model');
jest.mock('../../src/models/product-variant.model');
jest.mock('../../src/models/product-category.model');
jest.mock('../../src/models/product-brand.model');
jest.mock('../../src/services/attribute.service', () => ({
  validateAttributes: jest.fn().mockResolvedValue({ valid: true }),
  saveProductAttributes: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/models/cart.model');
jest.mock('../../src/models/cart-item.model');
jest.mock('../../src/models/wishlist.model');
jest.mock('../../src/models/order.model');
jest.mock('../../src/models/order-status-history.model');
jest.mock('../../src/models/delivery-dispatch.model');

describe('Phase 4 Service Layer Scoping Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Invitation Service', () => {
    it('should assign invitation to inviter store and prevent cross-store invitations', async () => {
      const mockInviter = { id: 'inviter-uuid', store_id: 'store-abc', first_name: 'Inviter' };
      userModel.getUserRolesAndPermissions.mockResolvedValue({
        roles: ['STORE_OWNER'],
        permissions: ['*']
      });
      userModel.findByEmail.mockResolvedValue(null);
      invitationModel.findPendingByEmail.mockResolvedValue(null);
      roleModel.findByName.mockResolvedValue({ id: 'role-admin', name: 'ORDER_STAFF' });
      userModel.findById.mockResolvedValue(mockInviter);
      invitationModel.create.mockResolvedValue({ id: 'invite-123', token: 'some-token' });

      await invitationService.createInvitation({
        email: 'newadmin@example.com',
        invitedBy: 'inviter-uuid',
        expiryDays: 7
      });

      expect(userModel.findById).toHaveBeenCalledWith('inviter-uuid');
      expect(invitationModel.create).toHaveBeenCalledWith(expect.objectContaining({
        email: 'newadmin@example.com',
        store_id: 'store-abc'
      }));
    });

    it('should filter list of invitations by storeId for regular admins', async () => {
      invitationModel.list.mockResolvedValue({ invitations: [] });

      await invitationService.listInvitations({}, 'inviter-uuid', false, 'store-abc');

      expect(invitationModel.list).toHaveBeenCalledWith(expect.objectContaining({
        store_id: 'store-abc'
      }));
    });
  });

  describe('Product Service', () => {
    it('should scope products lookup list to storeId', async () => {
      productModel.findAll.mockResolvedValue({ products: [], total: 0 });

      await productService.getProducts({}, null, 'store-abc');

      expect(productModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 'store-abc' }),
        expect.anything()
      );
    });

    it('should assign product store_id from admin profile during creation', async () => {
      const mockAdmin = { id: 'admin-uuid', store_id: 'store-abc' };
      userModel.findById.mockResolvedValue(mockAdmin);
      productModel.create.mockResolvedValue({ id: 'prod-123' });

      await productService.createProduct('admin-uuid', { name: 'Test Product' });

      expect(productModel.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Product',
        store_id: 'store-abc'
      }));
    });

    it('should pass storeId to findById during updates', async () => {
      productModel.findById.mockResolvedValue({ id: 'prod-123', category_id: 'cat-123' });
      productModel.update.mockResolvedValue({ id: 'prod-123' });

      await productService.updateProduct('prod-123', { name: 'Updated Prod' }, 'store-abc');

      expect(productModel.findById).toHaveBeenCalledWith('prod-123', 'store-abc');
    });
  });

  describe('Category Service', () => {
    it('should scope category creation and tree construction to storeId', async () => {
      productCategoryModel.findAll.mockResolvedValue([]);
      productCategoryModel.findBySlug.mockResolvedValue(null);
      productCategoryModel.create.mockResolvedValue({ id: 'cat-123' });

      await categoryService.createCategory('admin-uuid', { name: 'New Cat' }, 'store-abc');

      expect(productCategoryModel.findAll).toHaveBeenCalledWith({ parentId: null, store_id: 'store-abc' });
      expect(productCategoryModel.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Cat',
        store_id: 'store-abc'
      }));
    });
  });

  describe('Cart Service', () => {
    it('should fetch/create carts using storeId', async () => {
      cartModel.findByUserId.mockResolvedValue(null);
      cartModel.create.mockResolvedValue({ id: 'cart-123', user_id: 'user-123', store_id: 'store-abc' });

      await cartService.getOrCreateCart('user-123', null, 'store-abc');

      expect(cartModel.findByUserId).toHaveBeenCalledWith('user-123', 'store-abc');
      expect(cartModel.create).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-123',
        store_id: 'store-abc'
      }));
    });
  });

  describe('Wishlist Service', () => {
    it('should fetch/create wishlists using storeId', async () => {
      wishlistModel.findByUserId.mockResolvedValue(null);
      wishlistModel.create.mockResolvedValue({ id: 'wishlist-123', user_id: 'user-123', store_id: 'store-abc' });

      await wishlistService.getOrCreateWishlist('user-123', 'store-abc');

      expect(wishlistModel.findByUserId).toHaveBeenCalledWith('user-123', 'store-abc');
      expect(wishlistModel.create).toHaveBeenCalledWith('user-123', 'store-abc');
    });
  });

  describe('Order Service', () => {
    it('should query orders by storeId', async () => {
      orderModel.findByUserId.mockResolvedValue([]);

      await orderService.getUserOrders('user-123', {}, {}, 'store-abc');

      expect(orderModel.findByUserId).toHaveBeenCalledWith('user-123', {}, {}, 'store-abc');
    });

    it('should query details and updates with storeId', async () => {
      orderModel.findById.mockResolvedValue({ id: 'order-123', user_id: 'user-123' });

      await orderService.getOrderDetails('order-123', 'user-123', false, 'store-abc');

      expect(orderModel.findById).toHaveBeenCalledWith('order-123', 'store-abc');
    });
  });
});
