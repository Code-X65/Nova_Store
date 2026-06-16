require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');

async function testProductsAPI() {
  console.log('=== Starting Products API Endpoint Integration Test ===\n');

  try {
    // 1. Test standard GET /api/v1/products
    console.log('1. Testing GET /api/v1/products...');
    const listRes = await request(app)
      .get('/api/v1/products')
      .query({ limit: 5 });

    if (listRes.statusCode !== 200) {
      throw new Error(`Failed to list products. Status: ${listRes.statusCode}, body: ${JSON.stringify(listRes.body)}`);
    }
    
    const { products, pagination } = listRes.body.data;
    console.log(`✓ GET /api/v1/products returned status 200.`);
    console.log(`  Pagination info: Page ${pagination.page} of ${pagination.totalPages} (Total products: ${pagination.total})`);
    console.log(`  Fetched ${products.length} products on this page.`);

    if (products.length === 0) {
      console.log('⚠ No products found in the database. Seeding must have failed or is empty.');
      process.exit(1);
    }

    const sampleProduct = products[0];
    console.log(`  Sample product fetched: SKU="${sampleProduct.sku}", Name="${sampleProduct.name}", Price=$${sampleProduct.price}`);

    // 2. Test searching GET /api/v1/products?search=Apex
    console.log('\n2. Testing GET /api/v1/products with search filter (?search=Apex)...');
    const searchRes = await request(app)
      .get('/api/v1/products')
      .query({ search: 'Apex', limit: 3 });

    if (searchRes.statusCode !== 200) {
      throw new Error(`Failed to search products. Status: ${searchRes.statusCode}`);
    }
    console.log(`✓ Search returned status 200.`);
    console.log(`  Found ${searchRes.body.data.products.length} products matching "Apex".`);

    // 3. Test price range GET /api/v1/products?minPrice=50&maxPrice=500
    console.log('\n3. Testing GET /api/v1/products with price range (?minPrice=50&maxPrice=500)...');
    const priceRes = await request(app)
      .get('/api/v1/products')
      .query({ minPrice: 50, maxPrice: 500, limit: 3 });

    if (priceRes.statusCode !== 200) {
      throw new Error(`Failed to filter by price range. Status: ${priceRes.statusCode}`);
    }
    console.log(`✓ Price filtering returned status 200.`);
    const filteredProducts = priceRes.body.data.products;
    console.log(`  Found ${filteredProducts.length} products in range $50 - $500.`);
    filteredProducts.forEach(p => {
      console.log(`    - SKU: ${p.sku} | Price: $${p.price}`);
    });

    // 4. Test GET /api/v1/products/:id for the sample product
    console.log(`\n4. Testing GET /api/v1/products/:id using ID: "${sampleProduct.id}"...`);
    const detailRes = await request(app)
      .get(`/api/v1/products/${sampleProduct.id}`);

    if (detailRes.statusCode !== 200) {
      throw new Error(`Failed to get product details by ID. Status: ${detailRes.statusCode}`);
    }
    const detailedProduct = detailRes.body.data.product;
    console.log(`✓ Detailed lookup returned status 200.`);
    console.log(`  Name: "${detailedProduct.name}"`);
    console.log(`  Brand: "${detailedProduct.brand}"`);
    console.log(`  Category ID: "${detailedProduct.category_id}"`);
    console.log(`  Subcategory ID: "${detailedProduct.subcategory_id}"`);
    console.log(`  Attributes: ${JSON.stringify(detailedProduct.attributes)}`);

    // 5. Test GET /api/v1/products/slug/:slug
    console.log(`\n5. Testing GET /api/v1/products/slug/:slug using Slug: "${sampleProduct.slug}"...`);
    const slugRes = await request(app)
      .get(`/api/v1/products/slug/${sampleProduct.slug}`);

    if (slugRes.statusCode !== 200) {
      throw new Error(`Failed to get product details by Slug. Status: ${slugRes.statusCode}`);
    }
    const slugProduct = slugRes.body.data.product;
    console.log(`✓ Slug lookup returned status 200.`);
    console.log(`  Name from slug lookup: "${slugProduct.name}"`);

    console.log('\n=== All Product API Endpoint Tests Passed Successfully ===');
  } catch (error) {
    console.error('\n✗ Test Suite Failed:', error.message);
    process.exit(1);
  }

  // Graceful exit for async handles on Windows
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

testProductsAPI();
