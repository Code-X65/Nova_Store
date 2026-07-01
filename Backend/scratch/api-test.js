/**
 * Nova Store — Full API Test Suite
 * Node.js version — avoids all JSON quoting issues.
 * 
 * Run: node scratch/api-test.js
 * 
 * AUTH STRATEGY: Calls the running server at localhost:5000.
 * Uses full customer registration flow, then tests all product/category/brand endpoints.
 */

'use strict';

const BASE = 'http://localhost:5000/api/v1';

// ─── State ─────────────────────────────────────────────────────────────────
let PASS = 0, FAIL = 0;
let TOKEN = null;
let SESSION_COOKIE = null;
let BRAND_ID = null;
let CATEGORY_ID = null;
let SUBCATEGORY_ID = null;
let PRODUCT_ID = null;
let PRODUCT_SLUG = null;

const EMAIL    = 'apitestadmin@novatest.dev';
const PASSWORD = 'TestAdmin@2026!';

// ─── HTTP Helper ─────────────────────────────────────────────────────────────
async function api(method, path, body = null, auth = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN)          headers['Authorization'] = `Bearer ${TOKEN}`;
  if (SESSION_COOKIE) headers['Cookie']        = SESSION_COOKIE;
  if (auth === false) { delete headers['Authorization']; delete headers['Cookie']; }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res  = await fetch(`${BASE}${path}`, opts);
    let   data = {};
    try { data = await res.json(); } catch {}

    // Capture Set-Cookie from responses
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) SESSION_COOKIE = setCookie.split(';')[0];

    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { error: err.message } };
  }
}

// ─── Logging ─────────────────────────────────────────────────────────────────
function ok(label, detail = '') {
  console.log(`  \x1b[32m[PASS]\x1b[0m ${label}${detail ? ' -- ' + detail : ''}`);
  PASS++;
}
function fail(label, detail = '') {
  console.log(`  \x1b[31m[FAIL]\x1b[0m ${label}${detail ? ' -- ' + detail : ''}`);
  FAIL++;
}
function skip(label, reason = '') {
  console.log(`  \x1b[33m[SKIP]\x1b[0m ${label}${reason ? ' -- ' + reason : ''}`);
}
function section(title) {
  console.log(`\n\x1b[36m>> ${title}\x1b[0m`);
}

// ─── Test: AUTH ──────────────────────────────────────────────────────────────
async function testAuth() {
  section('AUTH');

  // Use pre-created admin user (avoids email/SMS external service calls)
  // Admin login returns a Bearer token directly
  const adminLogin = await api('POST', '/admin/login', { email: EMAIL, password: PASSWORD }, false);
  if (adminLogin.status === 200 && adminLogin.data?.data?.accessToken) {
    TOKEN = adminLogin.data.data.accessToken;
    ok('POST /admin/login (Bearer token)', `Status: 200, email: ${EMAIL}`);
  } else {
    fail('POST /admin/login', `${adminLogin.status} -- ${JSON.stringify(adminLogin.data)}`);
    throw new Error('Cannot proceed without auth token');
  }
}

// ─── Test: BRANDS ────────────────────────────────────────────────────────────
async function testBrands() {
  section('BRANDS');

  // GET all (public, no auth)
  let r = await api('GET', '/brands');
  r.status === 200 ? ok('GET /brands', `Status: 200`) : fail('GET /brands', `${r.status}`);

  // POST create
  const brandName = `TestBrand-${Date.now()}`;
  r = await api('POST', '/brands', {
    name:            brandName,
    description:     'Auto-generated test brand for API testing.',
    logo_url:        'https://placehold.co/200x200.png',
    website_url:     'https://testbrand.example.com',
    is_featured:     false,
    meta_title:      'Test Brand | Nova Store',
    meta_description:'Shop Test Brand products.',
  });
  if (r.status === 201 && r.data?.data?.brand?.id) {
    BRAND_ID = r.data.data.brand.id;
    ok('POST /brands', `id: ${BRAND_ID}`);
  } else {
    fail('POST /brands', `${r.status} -- ${JSON.stringify(r.data)}`);
  }

  // POST with no name --> 422
  r = await api('POST', '/brands', { description: 'No name brand' });
  r.status === 422 ? ok('POST /brands (no name -> 422)') : fail('POST /brands (no name -> 422)', `Got: ${r.status}`);

  if (BRAND_ID) {
    // GET by ID
    r = await api('GET', `/brands/${BRAND_ID}`);
    r.status === 200 ? ok('GET /brands/:id') : fail('GET /brands/:id', `${r.status}`);

    // PATCH update
    r = await api('PATCH', `/brands/${BRAND_ID}`, { is_featured: true, meta_description: 'Updated by test.' });
    r.status === 200 ? ok('PATCH /brands/:id') : fail('PATCH /brands/:id', `${r.status} -- ${JSON.stringify(r.data)}`);

    // PATCH empty body --> 422
    r = await api('PATCH', `/brands/${BRAND_ID}`, {});
    r.status === 422 ? ok('PATCH /brands/:id (empty -> 422)') : fail('PATCH /brands/:id (empty -> 422)', `Got: ${r.status}`);
  }
}

// ─── Test: CATEGORIES ────────────────────────────────────────────────────────
async function testCategories() {
  section('CATEGORIES');

  let r;

  // GET all
  r = await api('GET', '/categories');
  r.status === 200 ? ok('GET /categories', `Status: 200`) : fail('GET /categories', `${r.status}`);

  // GET tree
  r = await api('GET', '/categories?type=tree');
  r.status === 200 ? ok('GET /categories?type=tree') : fail('GET /categories?type=tree', `${r.status}`);

  // POST minimal (no description/image -- testing relaxed validation)
  r = await api('POST', '/categories', {
    name:            `TestCat-${Date.now()}`,
    icon:            'T',
    color:           '#4285F4',
    sort_order:      99,
    is_featured:     true,
    meta_title:      'Test Category | Nova Store',
    meta_description:'Auto-generated test category.',
  });
  if (r.status === 201 && r.data?.data?.category?.id) {
    CATEGORY_ID = r.data.data.category.id;
    ok('POST /categories (minimal -- no description/image)', `id: ${CATEGORY_ID}`);
  } else {
    fail('POST /categories (minimal)', `${r.status} -- ${JSON.stringify(r.data)}`);
  }

  // POST with ALL fields (including color)
  r = await api('POST', '/categories', {
    name:            `FullCat-${Date.now()}`,
    description:     'A fully-specified test category.',
    image_url:       'https://placehold.co/800x400.png',
    thumbnail_url:   'https://placehold.co/200x200.png',
    icon:            'F',
    color:           '#EA4335',
    sort_order:      100,
    is_featured:     false,
    meta_title:      'Full Category | Nova Store',
    meta_description:'Test category with all optional fields.',
    meta_keywords:   ['test', 'category', 'nova'],
  });
  r.status === 201 ? ok('POST /categories (all fields + color)', `id: ${r.data?.data?.category?.id}`) : fail('POST /categories (all fields)', `${r.status} -- ${JSON.stringify(r.data)}`);

  // POST subcategory
  if (CATEGORY_ID) {
    r = await api('POST', '/categories', {
      name:     `SubCat-${Date.now()}`,
      icon:     'S',
      color:    '#34A853',
      parentId: CATEGORY_ID,
    });
    if (r.status === 201 && r.data?.data?.category?.id) {
      SUBCATEGORY_ID = r.data.data.category.id;
      ok('POST /categories (subcategory)', `id: ${SUBCATEGORY_ID}`);
    } else {
      fail('POST /categories (subcategory)', `${r.status} -- ${JSON.stringify(r.data)}`);
    }
  }

  // GET by ID
  if (CATEGORY_ID) {
    r = await api('GET', `/categories/${CATEGORY_ID}`);
    r.status === 200 ? ok('GET /categories/:id') : fail('GET /categories/:id', `${r.status}`);
  }

  // GET subcategories
  if (CATEGORY_ID) {
    r = await api('GET', `/categories/${CATEGORY_ID}/subcategories`);
    r.status === 200 ? ok('GET /categories/:id/subcategories') : fail('GET /categories/:id/subcategories', `${r.status}`);
  }

  // PATCH update with color
  if (CATEGORY_ID) {
    r = await api('PATCH', `/categories/${CATEGORY_ID}`, {
      color:       '#FBBC04',
      description: 'Updated by API test suite.',
    });
    r.status === 200 ? ok('PATCH /categories/:id (with color)') : fail('PATCH /categories/:id', `${r.status} -- ${JSON.stringify(r.data)}`);
  }
}

// ─── Test: PRODUCTS ──────────────────────────────────────────────────────────
async function testProducts() {
  section('PRODUCTS');

  let r;

  // GET all (public)
  r = await api('GET', '/products');
  r.status === 200 ? ok('GET /products') : fail('GET /products', `${r.status}`);

  // GET featured
  r = await api('GET', '/products/featured');
  r.status === 200 ? ok('GET /products/featured') : fail('GET /products/featured', `${r.status}`);

  // GET search
  r = await api('GET', '/products/search?q=test');
  r.status === 200 ? ok('GET /products/search?q=test') : fail('GET /products/search', `${r.status}`);

  // GET recommendations
  r = await api('GET', '/products/recommendations?limit=5');
  r.status === 200 ? ok('GET /products/recommendations') : fail('GET /products/recommendations', `${r.status}`);

  if (!CATEGORY_ID) {
    skip('Product write tests', 'No categoryId available');
    return;
  }

  const ts = Date.now();

  // POST minimal (only 4 required fields)
  r = await api('POST', '/products', {
    sku:         `MIN-${ts}`,
    name:        'Minimal Test Product',
    category_id: CATEGORY_ID,
    price:       29.99,
  });
  if (r.status === 201 && r.data?.data?.product?.id) {
    ok('POST /products (minimal -- 4 required fields)', `id: ${r.data.data.product.id}`);
  } else {
    fail('POST /products (minimal)', `${r.status} -- ${JSON.stringify(r.data)}`);
  }

  // POST full product (ALL new fields)
  r = await api('POST', '/products', {
    sku:               `FULL-${ts}`,
    name:              `Full-Feature Earbuds ${ts}`,
    description:       'Premium noise-cancelling earbuds with 30hr battery life.',
    short_description: 'Best-in-class ANC earbuds.',
    category_id:       CATEGORY_ID,
    subcategory_id:    SUBCATEGORY_ID || null,
    brand_id:          BRAND_ID || null,
    price:             199.99,
    sale_price:        149.99,
    cost_price:        75.00,
    stock_quantity:    50,
    status:            'published',
    is_featured:       true,
    allow_backorder:   false,
    track_inventory:   true,
    currency:          'USD',
    // New fields
    color:             '#1A1A2E',
    weight:            0.25,
    dimensions_length: 15.0,
    dimensions_width:  8.0,
    dimensions_height: 3.5,
    tags:              ['wireless', 'noise-cancelling', 'premium', 'earbuds'],
    meta_title:        'Wireless Earbuds Pro | Nova Store',
    meta_description:  'Shop premium earbuds with ANC at Nova Store.',
    meta_keywords:     ['wireless earbuds', 'ANC', 'noise cancelling'],
    primary_image_url: 'https://placehold.co/800x800.png',
    thumbnail_url:     'https://placehold.co/200x200.png',
    image_gallery:     ['https://placehold.co/800x800.png'],
    variants: [
      { sku: `VAR-BLK-${ts}`, name: 'Midnight Black', option_values: { color: 'Black' }, stock_quantity: 30 },
      { sku: `VAR-WHT-${ts}`, name: 'Pearl White',    option_values: { color: 'White' }, stock_quantity: 20 },
    ],
  });
  if (r.status === 201 && r.data?.data?.product?.id) {
    PRODUCT_ID   = r.data.data.product.id;
    PRODUCT_SLUG = r.data.data.product.slug;
    const p = r.data.data.product;
    ok('POST /products (all new fields)', `id: ${PRODUCT_ID}`);
    (p.color === '#1A1A2E')   ? ok('  -> color field saved',            `Got: ${p.color}`)             : fail('  -> color field saved',            `Got: ${p.color}`);
    (p.weight != null)        ? ok('  -> weight field saved',           `Got: ${p.weight}`)            : fail('  -> weight field saved',           `Got: ${p.weight}`);
    (p.dimensions_length != null) ? ok('  -> dimensions_length saved', `Got: ${p.dimensions_length}`) : fail('  -> dimensions_length saved',      `Got: ${p.dimensions_length}`);
    (p.cost_price != null)    ? ok('  -> cost_price saved',            `Got: ${p.cost_price}`)        : fail('  -> cost_price saved',            `Got: ${p.cost_price}`);
    (Array.isArray(p.tags))   ? ok('  -> tags saved',                  `Got: ${JSON.stringify(p.tags)}`) : fail('  -> tags saved',               `Got: ${p.tags}`);
  } else {
    fail('POST /products (all new fields)', `${r.status} -- ${JSON.stringify(r.data)}`);
  }

  // POST missing required fields --> 422
  r = await api('POST', '/products', { name: 'No SKU or category' });
  r.status === 422 ? ok('POST /products (missing required -> 422)') : fail('POST /products (missing required -> 422)', `Got: ${r.status}`);

  if (PRODUCT_ID) {
    // GET by ID
    r = await api('GET', `/products/${PRODUCT_ID}`);
    r.status === 200 ? ok('GET /products/:id') : fail('GET /products/:id', `${r.status}`);

    // GET by slug
    if (PRODUCT_SLUG) {
      r = await api('GET', `/products/slug/${PRODUCT_SLUG}`);
      r.status === 200 ? ok('GET /products/slug/:slug') : fail('GET /products/slug/:slug', `${r.status}`);
    }

    // GET stock
    r = await api('GET', `/products/${PRODUCT_ID}/stock`);
    r.status === 200 ? ok('GET /products/:id/stock') : fail('GET /products/:id/stock', `${r.status}`);

    // PATCH update (new fields)
    r = await api('PATCH', `/products/${PRODUCT_ID}`, {
      color:           '#FF6B35',
      weight:          0.30,
      tags:            ['wireless', 'earbuds', 'updated'],
      meta_description:'Updated by API test suite.',
      allow_backorder: true,
    });
    r.status === 200 ? ok('PATCH /products/:id (new fields)') : fail('PATCH /products/:id', `${r.status} -- ${JSON.stringify(r.data)}`);

    // PATCH empty --> 422
    r = await api('PATCH', `/products/${PRODUCT_ID}`, {});
    r.status === 422 ? ok('PATCH /products/:id (empty -> 422)') : fail('PATCH /products/:id (empty -> 422)', `Got: ${r.status}`);
  }

  // GET filter by category
  r = await api('GET', `/products?category_id=${CATEGORY_ID}`);
  r.status === 200 ? ok('GET /products?category_id=...') : fail('GET /products?category_id=...', `${r.status}`);

  if (BRAND_ID) {
    r = await api('GET', `/products?brand_id=${BRAND_ID}`);
    r.status === 200 ? ok('GET /products?brand_id=...') : fail('GET /products?brand_id=...', `${r.status}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\x1b[1mNova Store API Test Suite\x1b[0m');
  console.log(`Target: ${BASE}`);
  console.log(`Time:   ${new Date().toISOString()}`);
  console.log('='.repeat(55));

  try {
    await testAuth();
    await testBrands();
    await testCategories();
    await testProducts();
  } catch (err) {
    console.error(`\n[FATAL] ${err.message}`);
    FAIL++;
  }

  console.log('\n' + '='.repeat(55));
  const total = PASS + FAIL;
  console.log(`RESULTS: ${PASS}/${total} passed, ${FAIL} failed`);
  console.log('='.repeat(55));

  if (BRAND_ID)       console.log(`Brand ID:       ${BRAND_ID}`);
  if (CATEGORY_ID)    console.log(`Category ID:    ${CATEGORY_ID}`);
  if (SUBCATEGORY_ID) console.log(`Subcategory ID: ${SUBCATEGORY_ID}`);
  if (PRODUCT_ID)     console.log(`Product ID:     ${PRODUCT_ID}`);
  if (PRODUCT_SLUG)   console.log(`Product Slug:   ${PRODUCT_SLUG}`);

  console.log('\nCheck these records in your Supabase dashboard!');
  process.exit(FAIL > 0 ? 1 : 0);
}

main();
