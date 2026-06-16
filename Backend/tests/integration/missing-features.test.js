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
    req.admin = { id: 'admin-uuid-999', is_active: true };
    req.user = { id: 'admin-uuid-999', role: 'ADMIN' };
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
});
