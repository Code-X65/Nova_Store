const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Mock models, services and config
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/user-role.model');
jest.mock('../../src/models/permission.model');
jest.mock('../../src/models/product.model');
jest.mock('../../src/services/order.service');
jest.mock('jsonwebtoken');

// Keep tracks of mocks we will change inside tests
const userModel = require('../../src/models/user.model');
const userRoleModel = require('../../src/models/user-role.model');
const permissionModel = require('../../src/models/permission.model');
const productModel = require('../../src/models/product.model');
const orderService = require('../../src/services/order.service');

// Mock requireAdmin to allow test requests
jest.mock('../../src/middlewares/require-admin.middleware', () => {
  return (req, res, next) => {
    req.admin = {
      id: 'admin-uuid-999',
      email: 'admin@example.com',
      role: 'ADMIN',
      roles: ['ADMIN'],
      is_active: true,
      permissions: ['*'] // Wildcard for test admin
    };
    req.user = { id: 'admin-uuid-999', role: 'ADMIN', permissions: req.admin.permissions };
    next();
  };
});

// Mock Supabase
jest.mock('../../src/config/supabase', () => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
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
    rpc: jest.fn(),
    supabaseAdmin: null
  };
  client.supabaseAdmin = client;
  return client;
});

const supabaseClient = require('../../src/config/supabase');

describe('Missing Features Integration Tests', () => {
  const adminUser = {
    id: 'f69cc976-7e47-4742-b656-7ebc68364048',
    email: 'admin@example.com',
    role: 'ADMIN'
  };
  const accessToken = 'mock-admin-token';

  beforeAll(() => {
    jwt.verify.mockReturnValue({ id: adminUser.id });
    userModel.findById.mockResolvedValue(adminUser);
    userRoleModel.getUserRoles.mockResolvedValue(['admin']);
    permissionModel.getUserPermissions.mockResolvedValue(['admin']);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.verify.mockReturnValue({ id: adminUser.id });
    
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      then: function(resolve) {
        resolve({ data: this._data || [], error: this._error || null });
      }
    };
    supabaseClient.from.mockImplementation(() => queryBuilder);
  });

  describe('Currencies Router', () => {
    it('GET /api/v1/currencies should list active currencies', async () => {
      const mockCurrencies = [
        { code: 'USD', symbol: '$', rate_to_base: 1.0, is_active: true },
        { code: 'NGN', symbol: '₦', rate_to_base: 1500.0, is_active: true }
      ];

      const queryBuilder = supabaseClient.from('currencies');
      queryBuilder._data = mockCurrencies;
      queryBuilder._error = null;

      const res = await request(app).get('/api/v1/currencies');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockCurrencies);
      expect(supabaseClient.from).toHaveBeenCalledWith('currencies');
    });

    it('PUT /api/v1/currencies/admin/:code should update currency exchange rate', async () => {
      const mockUpdated = { code: 'NGN', symbol: '₦', rate_to_base: 1600.0, is_active: true };
      
      supabaseClient.from().maybeSingle.mockResolvedValue({ data: mockUpdated, error: null });

      const res = await request(app)
        .put('/api/v1/currencies/admin/ngn')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ rate_to_base: 1600.0 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockUpdated);
      expect(supabaseClient.from).toHaveBeenCalledWith('currencies');
    });
  });

  describe('Upload Router', () => {
    const testFilePath = path.join(__dirname, 'test-upload.txt');

    beforeAll(() => {
      fs.writeFileSync(testFilePath, 'Nova Store Upload Test File Content');
    });

    afterAll(() => {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      
      // Clean up uploaded files in Backend/uploads folder
      const uploadDir = path.join(__dirname, '../../uploads');
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        for (const file of files) {
          if (file.startsWith('file-')) {
            fs.unlinkSync(path.join(uploadDir, file));
          }
        }
      }
    });

    it('POST /api/v1/admin/upload should upload an attachment successfully', async () => {
      const res = await request(app)
        .post('/api/v1/admin/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', testFilePath);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.filename).toBeDefined();
      expect(res.body.data.url).toContain('/uploads/');
      
      // Verify file exists in uploads folder
      const savedPath = path.join(__dirname, '../../uploads', res.body.data.filename);
      expect(fs.existsSync(savedPath)).toBe(true);
    });
  });

  describe('Product Full-Text Search Router', () => {
    it('GET /api/v1/products/search should perform database full-text search', async () => {
      const mockResults = [
        { id: 'prod-1', name: 'Gaming Headphones', description: 'Surround sound gaming headphones', price: 99.99 }
      ];

      productModel.search.mockResolvedValue(mockResults);

      const res = await request(app)
        .get('/api/v1/products/search')
        .query({ q: 'gaming', limit: 5 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResults);
      expect(productModel.search).toHaveBeenCalledWith('gaming', 5);
    });
  });

  describe('Order PDF Invoice Router', () => {
    it('GET /api/v1/orders/:id/invoice should serve PDF document stream', async () => {
      const mockOrder = {
        id: 'order-1',
        order_number: 'NS-10001',
        payment_status: 'paid',
        created_at: new Date().toISOString(),
        customer_email: 'customer@example.com',
        customer_phone: '1234567890',
        shipping_address: {
          first_name: 'John',
          last_name: 'Doe',
          street_address: '123 Forest St',
          city: 'Lagos',
          state: 'Lagos State',
          postal_code: '100001',
          country: 'Nigeria'
        },
        subtotal: 50000.0,
        shipping_cost: 1500.0,
        tax_amount: 3750.0,
        discount_amount: 0.0,
        total_amount: 55250.0,
        items: [
          { product_name: 'Premium Phone Case', sku: 'CASE-001', quantity: 1, unit_price: 50000.0, total_price: 50000.0 }
        ]
      };

      orderService.getOrderDetails.mockResolvedValue(mockOrder);

      const res = await request(app)
        .get('/api/v1/orders/order-1/invoice')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment; filename=invoice-NS-10001.pdf');
      
      // Verify content is a non-empty buffer (PDF format starts with %PDF)
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.toString('utf-8', 0, 4)).toBe('%PDF');
    });
  });

  describe('Health Router', () => {
    beforeAll(() => {
      const { redisClient } = require('../../src/config/redis');
      redisClient.ping = jest.fn().mockResolvedValue('PONG');
      redisClient.info = jest.fn().mockResolvedValue('redis_version:7.0.0');
    });

    it('GET /health should return overall health status', async () => {
      // Mock Supabase to succeed
      const queryBuilder = supabaseClient.from();
      queryBuilder._data = [{ id: 'user-1' }];
      queryBuilder._error = null;

      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.services.database.status).toBe('UP');
      expect(res.body.data.services.redis.status).toBe('UP');
    });

    it('GET /health/detailed should return latency and memory stats', async () => {
      const res = await request(app).get('/health/detailed');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checks.database.status).toBe('UP');
      expect(res.body.data.checks.redis.status).toBe('UP');
      // Memory status is environment-dependent (UP when under threshold, WARN when over)
      expect(['UP', 'WARN']).toContain(res.body.data.checks.memory.status);
    });

    it('GET /health/ready should return database readiness status', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('READY');
    });

    it('GET /health/live should return liveness uptime status', async () => {
      const res = await request(app).get('/health/live');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ALIVE');
    });
  });

  describe('Security & GDPR Features', () => {
    it('GET /api/v1/auth/csrf-token should return a CSRF token', async () => {
      const res = await request(app).get('/api/v1/auth/csrf-token');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.csrfToken).toBeDefined();
    });

    it('CSP headers should be present and contain dynamic script-src nonce', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain('nonce-');
    });

    it('GET /api/v1/user/gdpr/export should return structured export data', async () => {
      const mockUser = { id: adminUser.id, email: adminUser.email, first_name: 'Admin', last_name: 'User' };
      userModel.findById.mockResolvedValue(mockUser);

      const addresses = [{ id: 'addr-1', street_address: '123 Forest St' }];
      const orders = [{ id: 'order-1', total_amount: 500 }];
      const productReviews = [{ id: 'rev-1', rating: 5 }];
      const views = [{ id: 'view-1', product_id: 'prod-1' }];
      const searchLogs = [{ id: 'log-1', search_query: 'shoes' }];

      supabaseClient.from.mockImplementation((tableName) => {
        const q = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: (resolve) => {
            let data = [];
            if (tableName === 'addresses') data = addresses;
            else if (tableName === 'orders') data = orders;
            else if (tableName === 'product_reviews') data = productReviews;
            else if (tableName === 'user_product_views') data = views;
            else if (tableName === 'user_search_logs') data = searchLogs;
            resolve({ data, error: null });
          }
        };
        return q;
      });

      const res = await request(app)
        .get('/api/v1/user/gdpr/export')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.email).toBe(adminUser.email);
      expect(res.body.data.addresses).toEqual(addresses);
      expect(res.body.data.orders).toEqual(orders);
      expect(res.body.data.reviews).toEqual(productReviews);
      expect(res.body.data.telemetry.product_views).toEqual(views);
      expect(res.body.data.telemetry.search_logs).toEqual(searchLogs);
    });

    it('DELETE /api/v1/user/gdpr/forget should trigger user account anonymization and delete logs/addresses', async () => {
      userModel.update.mockResolvedValue({ id: adminUser.id, email: `deleted_${adminUser.id}@novastore.com` });

      let deletedTables = [];
      let updatedTables = [];

      supabaseClient.from.mockImplementation((tableName) => {
        return {
          update: jest.fn().mockImplementation((updates) => {
            updatedTables.push({ table: tableName, updates });
            return {
              eq: jest.fn().mockImplementation(() => {
                return {
                  then: (resolve) => resolve({ data: null, error: null })
                };
              })
            };
          }),
          delete: jest.fn().mockImplementation(() => {
            deletedTables.push(tableName);
            return {
              eq: jest.fn().mockImplementation(() => {
                return {
                  then: (resolve) => resolve({ data: null, error: null })
                };
              })
            };
          })
        };
      });

      const res = await request(app)
        .delete('/api/v1/user/gdpr/forget')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('erased and account deactivated');

      expect(userModel.update).toHaveBeenCalled();
      expect(updatedTables.some(t => t.table === 'orders')).toBe(true);
      expect(deletedTables).toContain('notifications');
      expect(deletedTables).toContain('notification_settings');
      expect(deletedTables).toContain('user_search_logs');
      expect(deletedTables).toContain('user_product_views');
      expect(deletedTables).toContain('addresses');
    });
  });
});
