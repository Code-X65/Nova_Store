/**
 * Nova Store — Full Product & Category API Test Suite
 * 
 * Tests: Auth → Brand → Category → Product (CRUD + new fields)
 * Sends real data to the database.
 * 
 * Run: node test-api.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const BASE = 'http://localhost:5000/api/v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let PASS = 0, FAIL = 0;
const results = [];

function log(label, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'SKIP' ? '⏭️' : '❌';
  console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`);
  results.push({ label, status, detail });
  if (status === 'PASS') PASS++;
  else if (status === 'FAIL') FAIL++;
}

async function req(method, path, body, token, expectStatus) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }

  return { status: res.status, data };
}

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  token: null,
  userId: null,
  brandId: null,
  categoryId: null,
  subcategoryId: null,
  productId: null,
  productSlug: null,
};

const testEmail = `api-tester-${Date.now()}@novatest.dev`;
const testPassword = 'TestPass@2026!';

// ─── Test Groups ──────────────────────────────────────────────────────────────

async function testAuth() {
  console.log('\n📋 AUTH');

  // Register
  const reg = await req('POST', '/auth/register', {
    first_name: 'API',
    last_name: 'Tester',
    email: testEmail,
    password: testPassword,
  });
  if (reg.status === 201 || reg.status === 200) {
    log('POST /auth/register', 'PASS', `User: ${testEmail}`);
  } else {
    log('POST /auth/register', 'FAIL', JSON.stringify(reg.data));
  }

  // Login
  const login = await req('POST', '/auth/login', { email: testEmail, password: testPassword });
  if (login.status === 200 && login.data.data?.accessToken) {
    state.token = login.data.data.accessToken;
    state.userId = login.data.data.user?.id;
    log('POST /auth/login', 'PASS', `Token acquired, userId: ${state.userId}`);
  } else {
    log('POST /auth/login', 'FAIL', JSON.stringify(login.data));
    throw new Error('Cannot proceed without auth token');
  }
}

async function testBrands() {
  console.log('\n🏷️  BRANDS');

  // GET all (public)
  const all = await req('GET', '/brands');
  log('GET /brands', all.status === 200 ? 'PASS' : 'FAIL', `Status: ${all.status}`);

  // POST create brand (now validated)
  const create = await req('POST', '/brands', {
    name: `TestBrand-${Date.now()}`,
    description: 'An auto-generated test brand created by the API test suite.',
    logo_url: 'https://placehold.co/200x200.png',
    thumbnail_url: 'https://placehold.co/80x80.png',
    website_url: 'https://testbrand.example.com',
    is_featured: false,
    meta_title: 'Test Brand | Nova Store',
    meta_description: 'Shop all Test Brand products at Nova Store.',
  }, state.token);

  if (create.status === 201 && create.data.data?.brand?.id) {
    state.brandId = create.data.data.brand.id;
    log('POST /brands', 'PASS', `Created brand id: ${state.brandId}`);
  } else {
    log('POST /brands', 'FAIL', JSON.stringify(create.data));
  }

  // POST create brand without name — should 422
  const noName = await req('POST', '/brands', { description: 'No name brand' }, state.token);
  log('POST /brands (no name → 422)', noName.status === 422 ? 'PASS' : 'FAIL', `Status: ${noName.status}`);

  // POST create duplicate brand — should 409
  if (state.brandId) {
    const dup = await req('GET', '/brands/' + state.brandId);
    if (dup.data.data?.brand?.name) {
      const dupCreate = await req('POST', '/brands', { name: dup.data.data.brand.name }, state.token);
      log('POST /brands (duplicate → 409)', dupCreate.status === 409 ? 'PASS' : 'FAIL', `Status: ${dupCreate.status}`);
    }
  }

  // GET brand by ID
  if (state.brandId) {
    const byId = await req('GET', `/brands/${state.brandId}`);
    log('GET /brands/:id', byId.status === 200 ? 'PASS' : 'FAIL', `Status: ${byId.status}`);
  }

  // PATCH update brand
  if (state.brandId) {
    const update = await req('PATCH', `/brands/${state.brandId}`, {
      meta_description: 'Updated by API test suite.',
      is_featured: true,
    }, state.token);
    log('PATCH /brands/:id', update.status === 200 ? 'PASS' : 'FAIL', `Status: ${update.status}`);
  }

  // PATCH with empty body — should 422 (min(1))
  if (state.brandId) {
    const emptyPatch = await req('PATCH', `/brands/${state.brandId}`, {}, state.token);
    log('PATCH /brands/:id (empty body → 422)', emptyPatch.status === 422 ? 'PASS' : 'FAIL', `Status: ${emptyPatch.status}`);
  }
}

async function testCategories() {
  console.log('\n📂 CATEGORIES');

  // GET all
  const all = await req('GET', '/categories');
  log('GET /categories (flat)', all.status === 200 ? 'PASS' : 'FAIL', `Status: ${all.status}`);

  // GET tree
  const tree = await req('GET', '/categories?type=tree');
  log('GET /categories?type=tree', tree.status === 200 ? 'PASS' : 'FAIL', `Status: ${tree.status}`);

  // POST create root category — minimal fields (testing relaxed validation)
  const create = await req('POST', '/categories', {
    name: `TestCategory-${Date.now()}`,
    icon: '🧪',
    color: '#4285F4',
    sort_order: 99,
    is_featured: true,
    meta_title: 'Test Category | Nova Store',
    meta_description: 'Auto-generated test category.',
  }, state.token);

  if (create.status === 201 && create.data.data?.category?.id) {
    state.categoryId = create.data.data.category.id;
    log('POST /categories (minimal — no description/image)', 'PASS', `id: ${state.categoryId}`);
  } else {
    log('POST /categories (minimal)', 'FAIL', JSON.stringify(create.data));
  }

  // POST create category WITH all fields (including new color)
  const full = await req('POST', '/categories', {
    name: `FullCategory-${Date.now()}`,
    description: 'A full test category with all fields provided.',
    image_url: 'https://placehold.co/800x400.png',
    thumbnail_url: 'https://placehold.co/200x200.png',
    icon: '🎯',
    color: '#EA4335',
    sort_order: 100,
    is_featured: false,
    meta_title: 'Full Category | Nova Store',
    meta_description: 'Test category with all optional fields.',
    meta_keywords: ['test', 'category', 'nova'],
  }, state.token);
  log('POST /categories (all fields)', full.status === 201 ? 'PASS' : 'FAIL', `Status: ${full.status}`);

  // POST create subcategory under root
  if (state.categoryId) {
    const sub = await req('POST', '/categories', {
      name: `SubCategory-${Date.now()}`,
      icon: '🔬',
      color: '#34A853',
      parentId: state.categoryId,
    }, state.token);

    if (sub.status === 201 && sub.data.data?.category?.id) {
      state.subcategoryId = sub.data.data.category.id;
      log('POST /categories (subcategory)', 'PASS', `id: ${state.subcategoryId}, parent: ${state.categoryId}`);
    } else {
      log('POST /categories (subcategory)', 'FAIL', JSON.stringify(sub.data));
    }
  }

  // GET by ID
  if (state.categoryId) {
    const byId = await req('GET', `/categories/${state.categoryId}`);
    log('GET /categories/:id', byId.status === 200 ? 'PASS' : 'FAIL', `Status: ${byId.status}`);
  }

  // GET subcategories
  if (state.categoryId) {
    const subs = await req('GET', `/categories/${state.categoryId}/subcategories`);
    const count = subs.data.data?.subcategories?.length ?? 0;
    log('GET /categories/:id/subcategories', subs.status === 200 ? 'PASS' : 'FAIL', `Found ${count} subcategories`);
  }

  // PATCH update category with color
  if (state.categoryId) {
    const update = await req('PATCH', `/categories/${state.categoryId}`, {
      color: '#FBBC04',
      description: 'Updated description from API test suite.',
    }, state.token);
    log('PATCH /categories/:id (with color)', update.status === 200 ? 'PASS' : 'FAIL', `Status: ${update.status}`);
  }

  // POST duplicate name — should 409
  if (state.categoryId) {
    const cat = await req('GET', `/categories/${state.categoryId}`);
    if (cat.data.data?.category?.name) {
      const dup = await req('POST', '/categories', { name: cat.data.data.category.name, icon: '⚠️' }, state.token);
      log('POST /categories (duplicate name → 409)', dup.status === 409 ? 'PASS' : 'FAIL', `Status: ${dup.status}`);
    }
  }
}

async function testProducts() {
  console.log('\n📦 PRODUCTS');

  // GET all products (public)
  const all = await req('GET', '/products');
  log('GET /products', all.status === 200 ? 'PASS' : 'FAIL', `Status: ${all.status}`);

  // GET featured
  const featured = await req('GET', '/products/featured');
  log('GET /products/featured', featured.status === 200 ? 'PASS' : 'FAIL', `Status: ${featured.status}`);

  // GET search
  const search = await req('GET', '/products/search?q=test');
  log('GET /products/search?q=test', search.status === 200 ? 'PASS' : 'FAIL', `Status: ${search.status}`);

  if (!state.categoryId) {
    log('POST /products', 'SKIP', 'No categoryId available');
    return;
  }

  // POST create minimal product (only required fields)
  const minProduct = await req('POST', '/products', {
    sku: `TEST-MIN-${Date.now()}`,
    name: 'Minimal Test Product',
    category_id: state.categoryId,
    price: 29.99,
  }, state.token);

  if (minProduct.status === 201 && minProduct.data.data?.product?.id) {
    log('POST /products (minimal — 4 required fields)', 'PASS', `id: ${minProduct.data.data.product.id}`);
  } else {
    log('POST /products (minimal)', 'FAIL', JSON.stringify(minProduct.data));
  }

  // POST create full product (all new fields including color, weight, dimensions, etc.)
  const fullProduct = await req('POST', '/products', {
    sku: `TEST-FULL-${Date.now()}`,
    name: `Full-Feature Wireless Earbuds ${Date.now()}`,
    description: 'Premium noise-cancelling wireless earbuds with 30hr battery life and ANC technology.',
    short_description: 'Best-in-class earbuds with ANC.',
    category_id: state.categoryId,
    subcategory_id: state.subcategoryId || null,
    brand_id: state.brandId || null,
    price: 199.99,
    sale_price: 149.99,
    cost_price: 75.00,
    stock_quantity: 50,
    status: 'published',
    is_featured: true,
    allow_backorder: false,
    track_inventory: true,
    currency: 'USD',
    // New fields being tested
    color: '#1A1A2E',
    weight: 0.25,
    dimensions_length: 15.0,
    dimensions_width: 8.0,
    dimensions_height: 3.5,
    tags: ['wireless', 'noise-cancelling', 'premium', 'earbuds'],
    meta_title: 'Full-Feature Wireless Earbuds | Nova Store',
    meta_description: 'Shop premium wireless earbuds with ANC at Nova Store. Free shipping on orders over $50.',
    meta_keywords: ['wireless earbuds', 'ANC', 'noise cancelling'],
    primary_image_url: 'https://placehold.co/800x800.png',
    thumbnail_url: 'https://placehold.co/200x200.png',
    image_gallery: [
      'https://placehold.co/800x800/black/white.png',
      'https://placehold.co/800x800/navy/white.png',
    ],
    variants: [
      { sku: `TEST-VAR-BLACK-${Date.now()}`, name: 'Midnight Black', option_values: { color: 'Black' }, stock_quantity: 30 },
      { sku: `TEST-VAR-WHITE-${Date.now()}`, name: 'Pearl White', option_values: { color: 'White' }, stock_quantity: 20 },
    ],
  }, state.token);

  if (fullProduct.status === 201 && fullProduct.data.data?.product?.id) {
    state.productId = fullProduct.data.data.product.id;
    state.productSlug = fullProduct.data.data.product.slug;
    log('POST /products (all new fields)', 'PASS', `id: ${state.productId}`);

    // Verify new fields were saved
    const saved = fullProduct.data.data.product;
    const colorOk = saved.color === '#1A1A2E';
    const weightOk = parseFloat(saved.weight) === 0.25;
    const tagsOk = Array.isArray(saved.tags) && saved.tags.length === 4;
    log('  → color field saved', colorOk ? 'PASS' : 'FAIL', `Got: ${saved.color}`);
    log('  → weight field saved', weightOk ? 'PASS' : 'FAIL', `Got: ${saved.weight}`);
    log('  → tags field saved', tagsOk ? 'PASS' : 'FAIL', `Got: ${JSON.stringify(saved.tags)}`);
    log('  → dimensions_length saved', saved.dimensions_length != null ? 'PASS' : 'FAIL', `Got: ${saved.dimensions_length}`);
    log('  → cost_price saved', saved.cost_price != null ? 'PASS' : 'FAIL', `Got: ${saved.cost_price}`);
  } else {
    log('POST /products (all new fields)', 'FAIL', JSON.stringify(fullProduct.data));
  }

  // POST without required fields — should 422
  const missingReq = await req('POST', '/products', {
    name: 'Product without SKU',
    price: 10,
  }, state.token);
  log('POST /products (missing sku+category_id → 422)', missingReq.status === 422 ? 'PASS' : 'FAIL', `Status: ${missingReq.status}`);

  // GET by ID
  if (state.productId) {
    const byId = await req('GET', `/products/${state.productId}`);
    log('GET /products/:id', byId.status === 200 ? 'PASS' : 'FAIL', `Status: ${byId.status}`);
  }

  // GET by slug
  if (state.productSlug) {
    const bySlug = await req('GET', `/products/slug/${state.productSlug}`);
    log('GET /products/slug/:slug', bySlug.status === 200 ? 'PASS' : 'FAIL', `Status: ${bySlug.status}`);
  }

  // GET stock check
  if (state.productId) {
    const stock = await req('GET', `/products/${state.productId}/stock`);
    log('GET /products/:id/stock', stock.status === 200 ? 'PASS' : 'FAIL', `Status: ${stock.status}`);
  }

  // PATCH update product (include new fields)
  if (state.productId) {
    const update = await req('PATCH', `/products/${state.productId}`, {
      color: '#FF6B35',
      weight: 0.30,
      tags: ['wireless', 'earbuds', 'updated'],
      meta_description: 'Updated description from API test suite.',
      allow_backorder: true,
    }, state.token);
    log('PATCH /products/:id (new fields)', update.status === 200 ? 'PASS' : 'FAIL', `Status: ${update.status}`);
  }

  // PATCH with empty body — should 422 (min(1))
  if (state.productId) {
    const emptyPatch = await req('PATCH', `/products/${state.productId}`, {}, state.token);
    log('PATCH /products/:id (empty body → 422)', emptyPatch.status === 422 ? 'PASS' : 'FAIL', `Status: ${emptyPatch.status}`);
  }

  // POST add image to gallery
  if (state.productId) {
    const addImg = await req('POST', `/products/${state.productId}/images`, {
      imageUrl: 'https://placehold.co/800x800/red/white.png'
    }, state.token);
    log('POST /products/:id/images', addImg.status === 200 ? 'PASS' : 'FAIL', `Status: ${addImg.status}`);
  }

  // GET filter by category
  if (state.categoryId) {
    const byCat = await req('GET', `/products?category_id=${state.categoryId}`);
    log('GET /products?category_id=...', byCat.status === 200 ? 'PASS' : 'FAIL', `Status: ${byCat.status}`);
  }

  // GET filter by brand
  if (state.brandId) {
    const byBrand = await req('GET', `/products?brand_id=${state.brandId}`);
    log('GET /products?brand_id=...', byBrand.status === 200 ? 'PASS' : 'FAIL', `Status: ${byBrand.status}`);
  }

  // GET recommendations
  const rec = await req('GET', '/products/recommendations?limit=5');
  log('GET /products/recommendations', rec.status === 200 ? 'PASS' : 'FAIL', `Status: ${rec.status}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Nova Store API Test Suite');
  console.log(`   Target: ${BASE}`);
  console.log(`   Time:   ${new Date().toISOString()}`);
  console.log('═'.repeat(50));

  try {
    await testAuth();
    await testBrands();
    await testCategories();
    await testProducts();
  } catch (err) {
    console.error('\n💥 Fatal error:', err.message);
    FAIL++;
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`📊 RESULTS: ${PASS} passed, ${FAIL} failed`);
  console.log('═'.repeat(50));

  if (state.brandId)    console.log(`🏷️  Brand ID:    ${state.brandId}`);
  if (state.categoryId) console.log(`📂 Category ID: ${state.categoryId}`);
  if (state.productId)  console.log(`📦 Product ID:  ${state.productId}`);
  if (state.productSlug)console.log(`🔗 Product Slug: ${state.productSlug}`);

  console.log('\n✨ You can check these records in your Supabase dashboard.');
  process.exit(FAIL > 0 ? 1 : 0);
}

main();
