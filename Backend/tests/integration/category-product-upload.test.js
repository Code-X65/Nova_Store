const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');

// Mock models and config
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/user-role.model');
jest.mock('../../src/models/permission.model');
jest.mock('../../src/models/product-category.model');
jest.mock('../../src/models/category-attribute.model');
jest.mock('../../src/models/product.model');
jest.mock('../../src/models/product-variant.model');
jest.mock('../../src/models/product-brand.model');
jest.mock('../../src/models/product-attribute.model');
jest.mock('../../src/models/audit-log.model');
jest.mock('../../src/middlewares/require-admin.middleware', () => {
  return (req, res, next) => {
    req.admin = {
      id: 'admin-uuid-999',
      email: 'admin@example.com',
      role: 'ADMIN',
      roles: ['ADMIN'],
      is_active: true,
      permissions: [
        'category:create', 'category:write',
        'product:create', 'product:write',
        'audit:read'
      ]
    };
    req.user = { id: 'admin-uuid-999', role: 'ADMIN', permissions: req.admin.permissions };
    next();
  };
});

jest.mock('../../src/config/supabase', () => {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve) => resolve({ data: [], error: null })
  };

  const client = {
    from: jest.fn().mockReturnValue(mockQueryBuilder),
    supabaseAdmin: null
  };
  client.supabaseAdmin = client;
  return client;
});
jest.mock('jsonwebtoken');

// Mock attribute inheritance resolution so we can control what attributes a category requires
jest.mock('../../src/utils/attribute-inheritance', () => ({
  resolveInheritedAttributes: jest.fn()
}));

describe('Category & Product Upload Integration Tests', () => {
  const adminUser = {
    id: 'f69cc976-7e47-4742-b656-7ebc68364048', // seeded admin ID
    email: 'admin@example.com',
    role: 'ADMIN'
  };
  const accessToken = 'mock-admin-token';

  beforeAll(() => {
    // Standard mock for admin auth protection
    jwt.verify.mockReturnValue({ id: adminUser.id });

    const userModel = require('../../src/models/user.model');
    userModel.findById.mockResolvedValue(adminUser);

    const userRoleModel = require('../../src/models/user-role.model');
    userRoleModel.getUserRoles.mockResolvedValue(['admin']);

    const permissionModel = require('../../src/models/permission.model');
    permissionModel.getUserPermissions.mockResolvedValue([
      'category:create',
      'category:write',
      'product:create',
      'product:write',
      'audit:read'
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.verify.mockReturnValue({ id: adminUser.id });
  });

  describe('POST /api/v1/categories/bulk', () => {
    it('should reject bulk category uploads that fail Joi schema validation', async () => {
      const invalidPayload = [
        {
          name: 'Sh', // Too short (min 2)
          description: 'Too short', // Too short (min 10)
          image_url: 'not-a-url', // Invalid URI
          thumbnail_url: 'not-a-url', // Invalid URI
          icon: '' // Cannot be empty
        }
      ];

      const res = await request(app)
        .post('/api/v1/categories/bulk')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should fail if a duplicate category name exists under the same parent', async () => {
      const categoryModel = require('../../src/models/product-category.model');
      
      // Mock categoryModel.findAll to return an existing category
      categoryModel.findAll.mockResolvedValue([
        { id: '11111111-1111-1111-1111-111111111111', name: 'Smartphones', slug: 'smartphones', parent_id: '22222222-2222-2222-2222-222222222222' }
      ]);

      const duplicatePayload = [
        {
          name: 'Electronics',
          description: 'Electronic gadgets and devices',
          image_url: 'https://example.com/elec.jpg',
          thumbnail_url: 'https://example.com/elec-thumb.jpg',
          icon: 'phone',
          subcategories: [
            {
              // Duplicate under Electronics
              name: 'Smartphones',
              description: 'Mobile smartphones',
              image_url: 'https://example.com/phone.jpg',
              thumbnail_url: 'https://example.com/phone-thumb.jpg',
              icon: 'smartphone'
            }
          ]
        }
      ];

      categoryModel.findAll.mockResolvedValueOnce([
        { id: '22222222-2222-2222-2222-222222222222', name: 'Electronics', slug: 'electronics', parent_id: null }
      ]);

      const res = await request(app)
        .post('/api/v1/categories/bulk')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(duplicatePayload);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already exists under this parent');
    });

    it('should successfully upload a valid hierarchical tree of categories in bulk', async () => {
      const categoryModel = require('../../src/models/product-category.model');
      categoryModel.findAll.mockResolvedValue([]);
      categoryModel.createMany.mockImplementation(data => data);

      const validPayload = [
        {
          name: 'Electronics',
          description: 'Electronic gadgets and devices',
          image_url: 'https://example.com/elec.jpg',
          thumbnail_url: 'https://example.com/elec-thumb.jpg',
          icon: 'phone',
          subcategories: [
            {
              name: 'Smartphones',
              description: 'Mobile smartphones',
              image_url: 'https://example.com/phone.jpg',
              thumbnail_url: 'https://example.com/phone-thumb.jpg',
              icon: 'smartphone'
            }
          ]
        }
      ];

      const res = await request(app)
        .post('/api/v1/categories/bulk')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toHaveLength(2);
      
      const rootCat = res.body.data.categories[0];
      const childCat = res.body.data.categories[1];

      expect(rootCat.name).toBe('Electronics');
      expect(rootCat.parent_id).toBeNull();
      expect(rootCat.level).toBe(0);

      expect(childCat.name).toBe('Smartphones');
      expect(childCat.parent_id).toBe(rootCat.id);
      expect(childCat.level).toBe(1);
      expect(childCat.full_path).toEqual(['electronics']);
    });
  });

  describe('POST /api/v1/products with Category Attributes', () => {
    const parentId = '11111111-1111-1111-1111-111111111111';
    const subcatId = '22222222-2222-2222-2222-222222222222';
    const brandId = '33333333-3333-3333-3333-333333333333';

    const mockCategory = { id: parentId, slug: 'electronics', level: 0, parent_id: null };
    const mockSubcategory = { id: subcatId, slug: 'smartphones', level: 1, parent_id: parentId };
    const mockBrand = { id: brandId, name: 'Apex' };

    beforeEach(() => {
      const productCategoryModel = require('../../src/models/product-category.model');
      const productBrandModel = require('../../src/models/product-brand.model');
      const productModel = require('../../src/models/product.model');
      const productAttributeModel = require('../../src/models/product-attribute.model');

      productCategoryModel.findById.mockImplementation((id) => {
        if (id === parentId) return mockCategory;
        if (id === subcatId) return mockSubcategory;
        return null;
      });

      productBrandModel.findById.mockResolvedValue(mockBrand);
      productModel.findBySlug.mockResolvedValue(null);
      productModel.create.mockImplementation((data) => ({
        id: 'new-product-uuid',
        ...data,
        category: 'electronics',
        subcategory: 'smartphones',
        brand: 'Apex'
      }));

      productAttributeModel.upsertBulk.mockResolvedValue([]);
    });

    it('should reject product creation if a required subcategory attribute is missing', async () => {
      const { resolveInheritedAttributes } = require('../../src/utils/attribute-inheritance');
      
      // Mock required "RAM" attribute template on subcategory
      resolveInheritedAttributes.mockResolvedValue([
        {
          id: '44444444-4444-4444-4444-444444444444',
          category_id: subcatId,
          attribute_name: 'RAM',
          attribute_type: 'enum',
          is_required: true,
          allowed_values: ['8GB', '12GB']
        }
      ]);

      const productPayload = {
        sku: 'TEST-SKU-ERR1',
        name: 'Apex Phone',
        description: 'Test product description.',
        category_id: parentId,
        subcategory_id: subcatId,
        brand_id: brandId,
        price: 999.99,
        stock_quantity: 10,
        attributes: {} // Missing 'RAM'
      };

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(productPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Required attribute "RAM" is missing');
    });

    it('should reject product creation if an attribute value fails type/enum validation', async () => {
      const { resolveInheritedAttributes } = require('../../src/utils/attribute-inheritance');
      
      resolveInheritedAttributes.mockResolvedValue([
        {
          id: '44444444-4444-4444-4444-444444444444',
          category_id: subcatId,
          attribute_name: 'RAM',
          attribute_type: 'enum',
          is_required: true,
          allowed_values: ['8GB', '12GB']
        }
      ]);

      const productPayload = {
        sku: 'TEST-SKU-ERR2',
        name: 'Apex Phone',
        description: 'Test product description.',
        category_id: parentId,
        subcategory_id: subcatId,
        brand_id: brandId,
        price: 999.99,
        stock_quantity: 10,
        attributes: {
          'RAM': '16GB' // Invalid (must be 8GB or 12GB)
        }
      };

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(productPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('must be one of: [8GB, 12GB]');
    });

    it('should succeed when valid subcategory attributes are provided and save them', async () => {
      const { resolveInheritedAttributes } = require('../../src/utils/attribute-inheritance');
      const productAttributeModel = require('../../src/models/product-attribute.model');

      resolveInheritedAttributes.mockResolvedValue([
        {
          id: '44444444-4444-4444-4444-444444444444',
          category_id: subcatId,
          attribute_name: 'RAM',
          attribute_type: 'enum',
          is_required: true,
          allowed_values: ['8GB', '12GB']
        }
      ]);

      const productPayload = {
        sku: 'TEST-SKU-OK',
        name: 'Apex Phone',
        description: 'Test product description.',
        category_id: parentId,
        subcategory_id: subcatId,
        brand_id: brandId,
        price: 999.99,
        stock_quantity: 10,
        attributes: {
          'RAM': '8GB' // Valid value!
        }
      };

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(productPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.id).toBe('new-product-uuid');

      // Verify attributes were saved
      expect(productAttributeModel.upsertBulk).toHaveBeenCalledWith('new-product-uuid', [
        {
          attribute_id: '44444444-4444-4444-4444-444444444444',
          attribute_value: '8GB'
        }
      ]);
    });
  });

  describe('GET /api/v1/admin/audit endpoints', () => {
    it('should successfully query general system activity audit logs', async () => {
      const AuditLogModel = require('../../src/models/audit-log.model');
      
      const mockLogs = [
        {
          id: 'log-uuid-001',
          action: 'category.bulk_created',
          resource_type: 'category',
          user_id: adminUser.id,
          new_values: { count: 2 },
          created_at: new Date().toISOString()
        }
      ];

      AuditLogModel.findAll.mockResolvedValue({
        logs: mockLogs,
        total: 1,
        page: 1,
        limit: 10
      });

      const res = await request(app)
        .get('/api/v1/admin/audit')
        .query({ resourceType: 'category' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logs).toHaveLength(1);
      expect(res.body.data.logs[0].action).toBe('category.bulk_created');
      expect(AuditLogModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        resourceType: 'category'
      }));
    });

    it('should successfully query aggregate audit statistics', async () => {
      const AuditLogModel = require('../../src/models/audit-log.model');
      
      const mockStats = {
        totalLogins: 50,
        failedLogins: 10,
        adminLogins: 5,
        failedAdminLogins: 1,
        lockouts: 2,
        adminLockouts: 0
      };

      AuditLogModel.getStats.mockResolvedValue(mockStats);

      const res = await request(app)
        .get('/api/v1/admin/audit/stats');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockStats);
      expect(AuditLogModel.getStats).toHaveBeenCalled();
    });
  });
});
