const storeContext = require('../../src/middlewares/store-context.middleware');
const requireAdmin = require('../../src/middlewares/require-admin.middleware');
const { ownsStore } = require('../../src/utils/store-helpers');
const storeModel = require('../../src/models/store.model');
const userModel = require('../../src/models/user.model');

jest.mock('../../src/models/store.model');
jest.mock('../../src/models/user.model');

describe('Phase 3 Store Middleware & Context Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { session: {}, user: {}, admin: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('storeContext middleware', () => {
    it('should attach user store if req.user has store_id', async () => {
      req.user = { id: 'user-123', store_id: 'store-abc' };
      const mockStore = { id: 'store-abc', slug: 'nova-store' };
      storeModel.findById.mockResolvedValue(mockStore);

      await storeContext(req, res, next);

      expect(storeModel.findById).toHaveBeenCalledWith('store-abc');
      expect(req.store).toEqual(mockStore);
      expect(next).toHaveBeenCalled();
    });

    it('should fall back to default store if no store context exists', async () => {
      req.user = null;
      req.session = null;
      const defaultStore = { id: 'store-default', slug: 'nova-store' };
      storeModel.getDefaultStore.mockResolvedValue(defaultStore);

      await storeContext(req, res, next);

      expect(req.store).toEqual(defaultStore);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireAdmin middleware integration', () => {
    it('should attach store_id to req.admin and req.user', async () => {
      req.session.adminId = 'admin-123';
      const mockAdmin = { id: 'admin-123', email: 'admin@example.com', store_id: 'store-abc', is_active: true };
      
      userModel.findById.mockResolvedValue(mockAdmin);
      userModel.getUserRolesAndPermissions.mockResolvedValue({
        roles: ['MANAGER'],
        permissions: ['product:read']
      });

      await requireAdmin(req, res, next);

      expect(req.admin.store_id).toBe('store-abc');
      expect(req.user.store_id).toBe('store-abc');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('ownsStore helper', () => {
    it('should return true for STORE_OWNER regardless of store_id matching', () => {
      const storeOwnerUser = { role: 'STORE_OWNER', store_id: 'store-abc' };
      expect(ownsStore(storeOwnerUser, 'store-xyz')).toBe(true);
    });

    it('should return true for matching store_id for normal MANAGER', () => {
      const managerUser = { role: 'MANAGER', store_id: 'store-abc' };
      expect(ownsStore(managerUser, 'store-abc')).toBe(true);
      expect(ownsStore(managerUser, 'store-xyz')).toBe(false);
    });

    it('should return false if user is undefined', () => {
      expect(ownsStore(null, 'store-abc')).toBe(false);
    });
  });
});
