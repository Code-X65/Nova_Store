require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Dynamic override to direct port 5432
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL
    .replace(':6543/', ':5432/')
    .replace('pgbouncer=true', '');
}

// Mock connect-pg-simple in Node's require cache for fast, reliable in-memory session management
const session = require('express-session');
const mockSessions = {};
const mockPgSession = function(sessionInstance) {
  const Store = sessionInstance.Store;
  class MockStore extends Store {
    constructor() {
      super();
    }
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
};

// Require interceptors
require.cache[require.resolve('connect-pg-simple')] = {
  id: require.resolve('connect-pg-simple'),
  exports: mockPgSession,
  loaded: true
};

// Mock timeout middleware to bypass timeouts in the test runner
require.cache[require.resolve('../src/middlewares/timeout.middleware')] = {
  id: require.resolve('../src/middlewares/timeout.middleware'),
  exports: () => (req, res, next) => next(),
  loaded: true
};

// Stub Redis connect to bypass reconnect loops and DNS lookup delays
const { redisClient } = require('../src/config/redis');
redisClient.connect = async () => {
  throw new Error('Redis connection bypassed for testing');
};

// Stub email, SMS, and notification services BEFORE requiring app.js
const notificationService = require('../src/services/notification.service');
const EmailService = require('../src/services/email.service');
const SMSService = require('../src/services/sms.service');
const notificationQueue = require('../src/services/notification-queue.service');

notificationQueue.enqueue = async () => true;
notificationService.sendToUser = async () => true;
notificationService.sendAdminInvitationEmail = async () => true;
notificationService.sendAdminInvitationAcceptedEmail = async () => true;
notificationService.sendAdminInvitationRevokedEmail = async () => true;

EmailService.sendTemplate = async () => true;
EmailService.sendMail = async () => true;
SMSService.send = async () => ({ success: true, messageId: 'msg-123' });

const request = require('supertest');
const { Client } = require('pg');
const app = require('../src/app');
const { connectRedis } = require('../src/config/redis');

// ANSI Color Helpers for nice CLI output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function logStep(msg) {
  console.log(`\n${colors.bold}${colors.cyan}=== STEP: ${msg} ===${colors.reset}`);
}

function logPass(msg) {
  console.log(`${colors.green}✔ [PASS] ${msg}${colors.reset}`);
}

function logFail(msg, error) {
  console.error(`${colors.red}✘ [FAIL] ${msg}${colors.reset}`);
  if (error) console.error(error);
}

// Global postgres client helper - reuse application connection pool
const pgPool = require('../src/config/db');

async function queryDatabase(queryText, params = []) {
  const res = await pgPool.query(queryText, params);
  return res.rows;
}

async function runTests() {
  console.log(`${colors.bold}🚀 STARTING NOVA STORE FLOW AND ENDPOINT TESTS 🚀${colors.reset}`);
  
  // Connect to Redis dynamically
  await connectRedis().catch(err => {
    console.log(`${colors.yellow}⚠️  Redis connection skipped/failed: ${err.message}. Rate limiters will fall back to MemoryStore.${colors.reset}`);
  });

  // Agents to maintain sessions and cookies
  const superAdminAgent = request.agent(app);
  const newAdminAgent = request.agent(app);

  let csrfTokenSuper = null;
  let csrfTokenNewAdmin = null;

  // 1. Initialise CSRF Token for SuperAdmin
  logStep('Initialise CSRF Token');
  try {
    const res = await superAdminAgent.get('/api/v1/auth/csrf-token');
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    csrfTokenSuper = res.body.csrfToken;
    logPass(`CSRF Token retrieved: ${csrfTokenSuper.slice(0, 10)}...`);
  } catch (err) {
    logFail('Failed to get initial CSRF Token', err);
    process.exit(1);
  }

  // 2. Login as SuperAdmin
  logStep('Login as SuperAdmin');
  try {
    const res = await superAdminAgent
      .post('/api/v1/admin/login')
      .set('x-csrf-token', csrfTokenSuper)
      .send({
        email: 'admin@novastore.com',
        password: 'SuperAdmin123!'
      });

    if (res.status !== 200) {
      throw new Error(`Login failed with status ${res.status}: ${JSON.stringify(res.body)}`);
    }
    logPass('Logged in as SuperAdmin.');

    // Refresh CSRF Token for authenticated session
    const csrfRes = await superAdminAgent.get('/api/v1/auth/csrf-token');
    csrfTokenSuper = csrfRes.body.csrfToken;
    logPass(`Authenticated CSRF Token retrieved: ${csrfTokenSuper.slice(0, 10)}...`);
  } catch (err) {
    logFail('SuperAdmin login failed', err);
    process.exit(1);
  }

  // 3. Invite a new Admin
  logStep('Invite New Admin');
  const testAdminEmail = `testadmin_${Date.now()}@novatest.dev`;
  try {
    const res = await superAdminAgent
      .post('/api/v1/admin/invitations')
      .set('x-csrf-token', csrfTokenSuper)
      .send({
        email: testAdminEmail
      });

    if (res.status !== 201) {
      throw new Error(`Invite failed with status ${res.status}: ${JSON.stringify(res.body)}`);
    }
    logPass(`Admin invitation sent to ${testAdminEmail}`);
  } catch (err) {
    logFail('Admin invitation failed', err);
    process.exit(1);
  }

  // 4. Retrieve Invitation Token from Database
  logStep('Retrieve Invitation Token');
  let inviteToken = null;
  try {
    const rows = await queryDatabase(
      'SELECT token FROM invitations WHERE email = $1 AND status = \'pending\' ORDER BY created_at DESC LIMIT 1',
      [testAdminEmail]
    );
    if (rows.length === 0) throw new Error('No pending invitation found in database.');
    inviteToken = rows[0].token;
    logPass(`Token retrieved from database: ${inviteToken.slice(0, 10)}...`);
  } catch (err) {
    logFail('Failed to retrieve token', err);
    process.exit(1);
  }

  // 5. Accept Invitation and Complete Onboarding
  logStep('Onboard New Admin');
  try {
    // 5a. Verify invitation info
    const infoRes = await request(app).get(`/api/v1/accept-invite/${inviteToken}`);
    if (infoRes.status !== 200) {
      throw new Error(`Verify invitation failed with status ${infoRes.status}: ${JSON.stringify(infoRes.body)}`);
    }
    logPass(`Invitation verified successfully. Recipient: ${infoRes.body.data.email}`);

    // 5b. Accept the invite
    const acceptRes = await request(app)
      .post(`/api/v1/accept-invite/${inviteToken}`)
      .send({
        password: 'NewAdmin123!',
        firstName: 'Test',
        lastName: 'Admin'
      });

    if (acceptRes.status !== 201) {
      throw new Error(`Accept invite failed with status ${acceptRes.status}: ${JSON.stringify(acceptRes.body)}`);
    }
    logPass(`Invitation accepted. Account created for ${testAdminEmail}`);
  } catch (err) {
    logFail('Admin onboarding failed', err);
    process.exit(1);
  }

  // 6. Login as the newly created Admin
  logStep('Login as New Admin');
  try {
    // Get initial CSRF for new agent
    const initCsrfRes = await newAdminAgent.get('/api/v1/auth/csrf-token');
    csrfTokenNewAdmin = initCsrfRes.body.csrfToken;

    const res = await newAdminAgent
      .post('/api/v1/admin/login')
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        email: testAdminEmail,
        password: 'NewAdmin123!'
      });

    if (res.status !== 200) {
      throw new Error(`New Admin login failed with status ${res.status}: ${JSON.stringify(res.body)}`);
    }
    logPass('Logged in as New Admin.');

    // Refresh CSRF Token for authenticated session
    const csrfRes = await newAdminAgent.get('/api/v1/auth/csrf-token');
    csrfTokenNewAdmin = csrfRes.body.csrfToken;
    logPass(`Authenticated New Admin CSRF Token retrieved: ${csrfTokenNewAdmin.slice(0, 10)}...`);
  } catch (err) {
    logFail('New Admin login failed', err);
    process.exit(1);
  }

  // 7. Create 5 Categories
  logStep('Create 5 Categories');
  const persistentCategoryIds = [];
  const persistentCategorySlugs = [];
  const categoryNames = [
    'Electronics Tech',
    'Apparel & Fashion',
    'Home Kitchen Products',
    'Beauty & Personal Care',
    'Sports & Outdoors Gear'
  ];

  try {
    for (let i = 0; i < 5; i++) {
      const name = `${categoryNames[i]} - ${Date.now()}`;
      const res = await newAdminAgent
        .post('/api/v1/categories')
        .set('x-csrf-token', csrfTokenNewAdmin)
        .send({
          name,
          description: `Detailed description for ${name} category.`
        });

      if (res.status !== 201) {
        throw new Error(`Failed to create category ${i + 1}: ${JSON.stringify(res.body)}`);
      }
      const category = res.body.data.category;
      persistentCategoryIds.push(category.id);
      persistentCategorySlugs.push(category.slug);
      logPass(`Created Category ${i + 1}: ${category.name} (ID: ${category.id})`);
    }
  } catch (err) {
    logFail('Category creation failed', err);
    process.exit(1);
  }

  // 8. Upload 2 Products under each Category (10 products total)
  logStep('Upload 2 Products per Category');
  const persistentProductIds = [];
  const persistentProductSlugs = [];
  try {
    for (let i = 0; i < 5; i++) {
      const categoryId = persistentCategoryIds[i];
      for (let j = 1; j <= 2; j++) {
        const prodIndex = i * 2 + j;
        const name = `Product ${prodIndex} - Model ${Date.now()}`;
        const sku = `SKU-PROD-${prodIndex}-${Date.now()}`;
        
        const res = await newAdminAgent
          .post('/api/v1/products')
          .set('x-csrf-token', csrfTokenNewAdmin)
          .send({
            sku,
            name,
            category_id: categoryId,
            price: 49.99 + prodIndex,
            description: `This is the detailed product description for ${name}.`,
            status: 'published',
            stock_quantity: 100
          });

        if (res.status !== 201) {
          throw new Error(`Failed to create product ${prodIndex}: ${JSON.stringify(res.body)}`);
        }
        const product = res.body.data.product;
        persistentProductIds.push(product.id);
        persistentProductSlugs.push(product.slug);
        logPass(`Created Product ${prodIndex}: ${product.name} (SKU: ${product.sku}) under Category ${i + 1}`);
      }
    }
  } catch (err) {
    logFail('Product creation failed', err);
    process.exit(1);
  }

  // 9. Test Brand Endpoints
  logStep('Test Brand Endpoints');
  let testBrandId = null;
  let testBrandSlug = null;
  try {
    // 9a. Create Brand
    const createRes = await newAdminAgent
      .post('/api/v1/brands')
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        name: `Brand_${Date.now()}`,
        description: 'Testing brand endpoints creation description'
      });
    if (createRes.status !== 201) throw new Error('Create brand failed.');
    testBrandId = createRes.body.data.brand.id;
    testBrandSlug = createRes.body.data.brand.slug;
    logPass(`Brand created (ID: ${testBrandId})`);

    // 9b. List Brands
    const listRes = await newAdminAgent.get('/api/v1/brands');
    if (listRes.status !== 200) throw new Error('List brands failed.');
    logPass('List brands endpoint verified.');

    // 9c. Get Brand by ID
    const getByIdRes = await newAdminAgent.get(`/api/v1/brands/${testBrandId}`);
    if (getByIdRes.status !== 200) throw new Error('Get brand by ID failed.');
    logPass('Get brand by ID endpoint verified.');

    // 9d. Get Brand by Slug
    const getBySlugRes = await newAdminAgent.get(`/api/v1/brands/slug/${testBrandSlug}`);
    if (getBySlugRes.status !== 200) throw new Error('Get brand by slug failed.');
    logPass('Get brand by slug endpoint verified.');

    // 9e. Update Brand
    const updateRes = await newAdminAgent
      .patch(`/api/v1/brands/${testBrandId}`)
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        description: 'Updated testing brand description'
      });
    if (updateRes.status !== 200) throw new Error('Update brand failed.');
    logPass('Update brand endpoint verified.');

    // 9f. Soft-delete Brand (temp brand)
    const tempBrandRes = await newAdminAgent
      .post('/api/v1/brands')
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        name: `TempBrand_${Date.now()}`,
        description: 'Temporary brand for delete test'
      });
    const tempBrandId = tempBrandRes.body.data.brand.id;
    const deleteRes = await newAdminAgent
      .delete(`/api/v1/brands/${tempBrandId}`)
      .set('x-csrf-token', csrfTokenNewAdmin);
    if (deleteRes.status !== 200) throw new Error('Delete brand failed.');
    logPass('Delete brand endpoint verified.');
  } catch (err) {
    logFail('Brand endpoints testing failed', err);
    process.exit(1);
  }

  // 10. Test Category Endpoints
  logStep('Test Category Endpoints');
  const checkCatId = persistentCategoryIds[0];
  const checkCatSlug = persistentCategorySlugs[0];
  try {
    // 10a. List Categories
    const listRes = await newAdminAgent.get('/api/v1/categories');
    if (listRes.status !== 200) throw new Error('List categories failed.');
    logPass('List categories endpoint verified.');

    // 10b. Get Category by ID
    const getByIdRes = await newAdminAgent.get(`/api/v1/categories/${checkCatId}`);
    if (getByIdRes.status !== 200) throw new Error('Get category by ID failed.');
    logPass('Get category by ID endpoint verified.');

    // 10c. Get Category by Slug
    const getBySlugRes = await newAdminAgent.get(`/api/v1/categories/slug/${checkCatSlug}`);
    if (getBySlugRes.status !== 200) throw new Error('Get category by slug failed.');
    logPass('Get category by slug endpoint verified.');

    // 10d. Get Subcategories
    const subRes = await newAdminAgent.get(`/api/v1/categories/${checkCatId}/subcategories`);
    if (subRes.status !== 200) throw new Error('Get subcategories failed.');
    logPass('Get subcategories endpoint verified.');

    // 10e. Bulk Create Categories
    const bulkRes = await newAdminAgent
      .post('/api/v1/categories/bulk')
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send([
        {
          name: `BulkCategory_${Date.now()}`,
          description: 'Testing bulk category creation description'
        }
      ]);
    if (bulkRes.status !== 201) throw new Error(`Bulk category failed: ${JSON.stringify(bulkRes.body)}`);
    logPass('Bulk category creation endpoint verified.');

    // 10f. Update Category
    const updateRes = await newAdminAgent
      .patch(`/api/v1/categories/${checkCatId}`)
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        description: 'Updated category testing description (10+ characters).'
      });
    if (updateRes.status !== 200) throw new Error(`Update category failed: ${JSON.stringify(updateRes.body)}`);
    logPass('Update category endpoint verified.');

    // 10g. Delete Category (temp category)
    const tempCatRes = await newAdminAgent
      .post('/api/v1/categories')
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        name: `TempCat_${Date.now()}`,
        description: 'Temporary category for delete test'
      });
    const tempCatId = tempCatRes.body.data.category.id;
    const deleteRes = await newAdminAgent
      .delete(`/api/v1/categories/${tempCatId}`)
      .set('x-csrf-token', csrfTokenNewAdmin);
    if (deleteRes.status !== 200) throw new Error('Delete category failed.');
    logPass('Delete category endpoint verified.');
  } catch (err) {
    logFail('Category endpoints testing failed', err);
    process.exit(1);
  }

  // 11. Test Product Endpoints
  logStep('Test Product Endpoints');
  const checkProdId = persistentProductIds[0];
  const checkProdSlug = persistentProductSlugs[0];
  try {
    // 11a. List Products
    const listRes = await newAdminAgent.get('/api/v1/products');
    if (listRes.status !== 200) throw new Error('List products failed.');
    logPass('List products endpoint verified.');

    // 11b. Get Product by ID
    const getByIdRes = await newAdminAgent.get(`/api/v1/products/${checkProdId}`);
    if (getByIdRes.status !== 200) throw new Error('Get product by ID failed.');
    logPass('Get product by ID endpoint verified.');

    // 11c. Get Product by Slug
    const getBySlugRes = await newAdminAgent.get(`/api/v1/products/slug/${checkProdSlug}`);
    if (getBySlugRes.status !== 200) throw new Error('Get product by slug failed.');
    logPass('Get product by slug endpoint verified.');

    // 11d. Check Stock
    const stockRes = await newAdminAgent.get(`/api/v1/products/${checkProdId}/stock`);
    if (stockRes.status !== 200) throw new Error('Check stock failed.');
    logPass('Check stock endpoint verified.');

    // 11e. Get Featured Products
    const featuredRes = await newAdminAgent.get('/api/v1/products/featured');
    if (featuredRes.status !== 200) throw new Error('Get featured products failed.');
    logPass('Get featured products endpoint verified.');

    // 11f. Search Products
    const searchRes = await newAdminAgent.get('/api/v1/products/search?q=Product');
    if (searchRes.status !== 200) throw new Error('Search products failed.');
    logPass('Search products endpoint verified.');

    // 11g. Recommendations
    const recRes = await newAdminAgent.get('/api/v1/products/recommendations');
    if (recRes.status !== 200) throw new Error('Recommendations endpoint failed.');
    logPass('Get recommendations endpoint verified.');

    // 11h. Update Product
    const updateRes = await newAdminAgent
      .patch(`/api/v1/products/${checkProdId}`)
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        description: 'Updated product description for endpoint verification.'
      });
    if (updateRes.status !== 200) throw new Error('Update product failed.');
    logPass('Update product endpoint verified.');

    // 11i. Product Image Gallery Endpoints
    const addImageRes = await newAdminAgent
      .post(`/api/v1/products/${checkProdId}/images`)
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        imageUrl: 'https://example.com/gallery-image.jpg'
      });
    if (addImageRes.status !== 200) throw new Error('Add product image failed.');
    logPass('Add product image endpoint verified.');

    const removeImageRes = await newAdminAgent
      .delete(`/api/v1/products/${checkProdId}/images/0`)
      .set('x-csrf-token', csrfTokenNewAdmin);
    if (removeImageRes.status !== 200) throw new Error('Remove product image failed.');
    logPass('Remove product image endpoint verified.');

    // 11j. Product Variant Endpoints
    const tempProdRes = await newAdminAgent
      .post('/api/v1/products')
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        sku: `TEMP-SKU-VAR-${Date.now()}`,
        name: `Temp Variant Product ${Date.now()}`,
        category_id: checkCatId,
        price: 15.99,
        status: 'published',
        variants: [
          {
            sku: `TEMP-SKU-V1-${Date.now()}`,
            name: 'Size M',
            option_values: { size: 'M' },
            stock_quantity: 10
          }
        ]
      });
    
    if (tempProdRes.status !== 201) throw new Error(`Create temp product with variant failed: ${JSON.stringify(tempProdRes.body)}`);
    const tempProductId = tempProdRes.body.data.product.id;
    const tempVariantId = tempProdRes.body.data.product.variants[0].id;
    logPass(`Temp product with variant created (Prod ID: ${tempProductId}, Var ID: ${tempVariantId})`);

    const updateVariantRes = await newAdminAgent
      .put(`/api/v1/products/${tempProductId}/variants/${tempVariantId}`)
      .set('x-csrf-token', csrfTokenNewAdmin)
      .send({
        sku: `TEMP-SKU-V1-MOD-${Date.now()}`,
        name: 'Size M Modified',
        option_values: { size: 'M' },
        stock_quantity: 20
      });
    if (updateVariantRes.status !== 200) throw new Error('Update variant failed.');
    logPass('Update product variant endpoint verified.');

    const deleteVariantRes = await newAdminAgent
      .delete(`/api/v1/products/${tempProductId}/variants/${tempVariantId}`)
      .set('x-csrf-token', csrfTokenNewAdmin);
    if (deleteVariantRes.status !== 200) throw new Error('Delete variant failed.');
    logPass('Delete product variant endpoint verified.');

    // 11k. Soft-delete Product
    const deleteProductRes = await newAdminAgent
      .delete(`/api/v1/products/${tempProductId}`)
      .set('x-csrf-token', csrfTokenNewAdmin);
    if (deleteProductRes.status !== 200) throw new Error('Delete product failed.');
    logPass('Delete product endpoint verified.');
  } catch (err) {
    logFail('Product endpoints testing failed', err);
    process.exit(1);
  }

  // 12. Verify Audit Trail Logs
  logStep('Verify Audit Trail');
  try {
    const auditRes = await superAdminAgent.get('/api/v1/admin/audit?limit=100');
    if (auditRes.status !== 200) {
      throw new Error(`Failed to fetch audit logs: ${JSON.stringify(auditRes.body)}`);
    }
    const logs = auditRes.body.data.logs;
    
    const actionsToVerify = ['admin_invitation_sent', 'category.created', 'product.created', 'brand.created'];
    const foundActions = {};

    logs.forEach(log => {
      if (actionsToVerify.includes(log.action)) {
        foundActions[log.action] = true;
      }
    });

    actionsToVerify.forEach(action => {
      if (foundActions[action]) {
        logPass(`Audit log entry for action "${action}" verified in database.`);
      } else {
        throw new Error(`Audit log entry for action "${action}" NOT found in database.`);
      }
    });
  } catch (err) {
    logFail('Audit trail verification failed', err);
    process.exit(1);
  }

  // 13. Persistence Check
  logStep('Persistence Check');
  try {
    const catsInDb = await queryDatabase('SELECT count(*)::int FROM product_categories WHERE deleted_at IS NULL AND id = ANY($1)', [persistentCategoryIds]);
    const prodsInDb = await queryDatabase('SELECT count(*)::int FROM products WHERE deleted_at IS NULL AND id = ANY($1)', [persistentProductIds]);

    if (catsInDb[0].count !== 5 || prodsInDb[0].count !== 10) {
      throw new Error(`Persistence validation failed: expected 5 categories and 10 products, but found ${catsInDb[0].count} categories and ${prodsInDb[0].count} products.`);
    }

    logPass(`Database persistent items confirmed: ${catsInDb[0].count} categories and ${prodsInDb[0].count} products are stored.`);
  } catch (err) {
    logFail('Persistence verification failed', err);
    process.exit(1);
  }

  console.log(`\n${colors.bold}${colors.green}🎉 ALL TESTS COMPLETED SUCCESSFULLY! 🎉${colors.reset}`);
  process.exit(0);
}

runTests();
