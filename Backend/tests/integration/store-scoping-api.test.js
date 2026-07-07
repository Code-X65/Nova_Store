/**
 * store-scoping-api.test.js
 *
 * Integration tests for store-scoping API restrictions (Phase 5).
 * Validates that:
 * 1. Admin endpoints resolve store context and enforce scopeToStore middleware.
 * 2. Public product, category, and brand endpoints resolve store context and query database with store scoping.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
jest.setTimeout(30000);
const request = require('supertest');

// --- Global Mocks ---
jest.mock('../../src/middlewares/rate-limit.middleware', () => ({
  authLimiter: (req, res, next) => next(),
  adminLoginLimiter: (req, res, next) => next(),
  resetLimiter: (req, res, next) => next(),
  refreshLimiter: (req, res, next) => next(),
  adminLimiter: (req, res, next) => next(),
  apiLimiter: (req, res, next) => next(),
  inviteLimiter: (req, res, next) => next(),
  healthLimiter: (req, res, next) => next()
}));

let mockSessions = {};
jest.mock('connect-pg-simple', () => (session) => {
  const Store = session.Store;
  class MockStore extends Store {
    constructor() { super(); }
    get(sid, cb) {
      const cleanSid = sid.startsWith('s:') ? sid.slice(2).split('.')[0] : sid;
      cb(null, mockSessions[cleanSid] || null);
    }
    set(sid, sess, cb) {
      const cleanSid = sid.startsWith('s:') ? sid.slice(2).split('.')[0] : sid;
      mockSessions[cleanSid] = sess;
      cb(null);
    }
    destroy(sid, cb) {
      const cleanSid = sid.startsWith('s:') ? sid.slice(2).split('.')[0] : sid;
      delete mockSessions[cleanSid];
      cb(null);
    }
  }
  return MockStore;
});

jest.mock('../../src/config/redis', () => ({
  redisClient: {
    isOpen: false,
    connect: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    sAdd: jest.fn().mockResolvedValue(1),
    sRem: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockResolvedValue([])
  },
  connectRedis: jest.fn()
}));

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue(undefined),
  logRaw: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../src/config/supabase', () => {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    update: jest.fn().mockResolvedValue({ data: [], error: null }),
    delete: jest.fn().mockResolvedValue({ data: [], error: null }),
    then: jest.fn((resolve) => resolve({ data: [], error: null }))
  };

  const client = {
    from: jest.fn().mockReturnValue(mockQuery),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
    }
  };

  return {
    supabase: client,
    supabaseAdmin: client,
    from: client.from,
    rpc: client.rpc,
    auth: client.auth
  };
});

// Mock Models
const userModel = require('../../src/models/user.model');
const storeModel = require('../../src/models/store.model');
const productModel = require('../../src/models/product.model');
const productCategoryModel = require('../../src/models/product-category.model');
const productBrandModel = require('../../src/models/product-brand.model');
const authService = require('../../src/services/auth.service');

jest.mock('../../src/models/user.model');
jest.mock('../../src/models/store.model');
jest.mock('../../src/models/product.model');
jest.mock('../../src/models/product-category.model');
jest.mock('../../src/models/product-brand.model');
jest.mock('../../src/services/auth.service');

const app = require('../../src/app');

describe('Phase 5 Integration Tests — Store Scoping API Restrictions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessions = {};

    // Standard mock implementation for store lookups
    storeModel.findById.mockImplementation(async (id) => {
      if (id === 'store-abc') return { id: 'store-abc', name: 'Store ABC', slug: 'store-abc' };
      if (id === 'store-xyz') return { id: 'store-xyz', name: 'Store XYZ', slug: 'store-xyz' };
      return null;
    });

    storeModel.getDefaultStore.mockResolvedValue({ id: 'store-default', name: 'Default Store', slug: 'store-default' });

    authService.adminLogin.mockImplementation(async (email) => {
      const storeId = email.includes('xyz') ? 'store-xyz' : 'store-abc';
      return {
        user: {
          id: 'admin-uuid',
          email,
          role: 'MANAGER',
          store_id: storeId,
          is_active: true
        }
      };
    });
  });

  describe('Admin Routing & scopeToStore Middleware', () => {
    it('should allow access to admin routes if admin store_id matches target store context', async () => {
      const mockAdmin = {
        id: 'admin-uuid',
        email: 'admin@example.com',
        role: 'MANAGER',
        store_id: 'store-abc',
        is_active: true
      };

      userModel.findByEmail.mockResolvedValue(mockAdmin);
      userModel.findById.mockResolvedValue(mockAdmin);
      userModel.comparePassword.mockResolvedValue(true);
      userModel.getUserRolesAndPermissions.mockResolvedValue({
        roles: ['MANAGER'],
        permissions: ['*']
      });

      const agent = request.agent(app);

      // Login to seed session
      await agent
        .post('/api/v1/admin/login')
        .send({ email: 'admin@example.com', password: 'password123' });

      // Retrieve CSRF token
      const csrfRes = await agent.get('/api/v1/auth/csrf-token');
      const csrfToken = csrfRes.body.csrfToken;

      // Access session endpoint — should succeed because req.store will resolve to default or admin store,
      // and ownsStore matches 'store-abc' or fallback default. Let's make sure context resolves to store-abc.
      // We set req.admin.store_id = 'store-abc', which resolves req.store to 'store-abc' in store-context middleware.
      const res = await agent
        .get('/api/v1/admin/sessions')
        .set('x-csrf-token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow access to admin routes for SUPER_ADMIN regardless of store_id', async () => {
      const mockSuperAdmin = {
        id: 'super-uuid',
        email: 'super@example.com',
        role: 'STORE_OWNER',
        store_id: null, // Super admins might not be tied to a specific store
        is_active: true
      };

      userModel.findByEmail.mockResolvedValue(mockSuperAdmin);
      userModel.findById.mockResolvedValue(mockSuperAdmin);
      userModel.comparePassword.mockResolvedValue(true);
      userModel.getUserRolesAndPermissions.mockResolvedValue({
        roles: ['STORE_OWNER'],
        permissions: ['*']
      });

      const agent = request.agent(app);

      await agent
        .post('/api/v1/admin/login')
        .send({ email: 'super@example.com', password: 'password123' });

      const csrfRes = await agent.get('/api/v1/auth/csrf-token');
      const csrfToken = csrfRes.body.csrfToken;

      // Force storeContext to resolve to store-xyz, even if super admin has no store
      storeModel.findUserStore.mockResolvedValue({ id: 'store-xyz', name: 'Store XYZ' });
      storeModel.findById.mockResolvedValue({ id: 'store-xyz', name: 'Store XYZ' });

      const res = await agent
        .get('/api/v1/admin/sessions')
        .set('x-csrf-token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject access (403) to admin routes if admin store_id does not match target store context', async () => {
      // Create admin for store-xyz
      const mockAdmin = {
        id: 'admin-uuid',
        email: 'admin@example.com',
        role: 'MANAGER',
        store_id: 'store-xyz',
        is_active: true
      };

      userModel.findByEmail.mockResolvedValue(mockAdmin);
      userModel.findById.mockResolvedValue(mockAdmin);
      userModel.comparePassword.mockResolvedValue(true);
      userModel.getUserRolesAndPermissions.mockResolvedValue({
        roles: ['MANAGER'],
        permissions: ['session:read']
      });

      const agent = request.agent(app);

      // Login
      await agent
        .post('/api/v1/admin/login')
        .send({ email: 'admin@example.com', password: 'password123' });

      const csrfRes = await agent.get('/api/v1/auth/csrf-token');
      const csrfToken = csrfRes.body.csrfToken;

      // Force storeContext to resolve to store-abc
      // If storeContext resolves req.store to store-abc but req.admin.store_id is store-xyz, ownsStore fails!
      // To simulate this, we override storeModel.findById for store-xyz to return null, or mock storeContext directly.
      // But ownsStore helper does: ownsStore(admin, storeId) => admin.role === 'SUPER_ADMIN' || admin.store_id === storeId
      // Since req.admin.store_id is 'store-xyz' and resolved req.store.id is 'store-abc', ownsStore returns false.
      // Let's force store context to resolve to 'store-abc' when finding user store
      storeModel.findUserStore.mockResolvedValue({ id: 'store-abc', name: 'Store ABC' });
      storeModel.findById.mockResolvedValue({ id: 'store-abc', name: 'Store ABC' });

      const res = await agent
        .get('/api/v1/admin/sessions')
        .set('x-csrf-token', csrfToken);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('permission to access data');
    });
  });

  describe('Customer (Public) Routes Store Scoping', () => {
    it('should scope product listing queries to current store context', async () => {
      productModel.findAll.mockResolvedValue({ products: [], pagination: { total: 0 } });

      const res = await request(app)
        .get('/api/v1/products')
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(productModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 'store-default' }),
        expect.any(Object)
      );
    });

    it('should scope category listing queries to current store context', async () => {
      productCategoryModel.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/categories');

      expect(res.status).toBe(200);
      expect(productCategoryModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 'store-default' })
      );
    });

    it('should scope brand listing queries to current store context', async () => {
      productBrandModel.findAll.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/brands');

      expect(res.status).toBe(200);
      expect(productBrandModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 'store-default' })
      );
    });
  });
});
