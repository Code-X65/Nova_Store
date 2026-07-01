const dotenv = require('dotenv');
dotenv.config();

const ProductModel = require('../src/models/product.model');
const ProductService = require('../src/services/product.service');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('🚀 Starting Advanced Search Features Verification...');

  // 1. Get user ID
  let targetUserId = null;
  const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
  if (!userErr && users && users.length > 0) {
    targetUserId = users[0].id;
  }
  console.log(`Using target user ID: ${targetUserId}`);

  // 2. Create products with null description
  console.log('Creating test product with null description...');
  const testProduct = await ProductModel.create({
    sku: `TEST-FTS-${Date.now()}`,
    name: 'UniqueGoldHeadphones',
    slug: `uniquegoldheadphones-${Date.now()}`,
    category: 'electronics',
    price: 450.00,
    stock_quantity: 10,
    track_inventory: true,
    created_by: targetUserId,
    description: null // NULL description!
  });
  console.log(`Created Product ID: ${testProduct.id}`);

  try {
    // 3. Test Full-Text Search
    console.log('Testing full-text search across coalesce indexes...');
    // Querying 'UniqueGoldHeadphones' should return the product
    const searchResults = await ProductService.searchProducts('UniqueGoldHeadphones', 10);
    console.log('Search results count:', searchResults.length);
    const foundProduct = searchResults.find(p => p.id === testProduct.id);

    if (!foundProduct) {
      throw new Error('Verification failed: Product with null description was not found in FTS results!');
    }
    console.log('✅ Success: Full-text search with null description succeeded.');

    // 4. Test Price Range Slider Optimization
    console.log('Testing getPriceRange endpoint output...');
    const priceRange = await ProductService.getPriceRange({ search: 'UniqueGoldHeadphones' }, { role: 'ADMIN' });
    console.log('Price range response:', priceRange);

    if (priceRange.minPrice !== 450.00 || priceRange.maxPrice !== 450.00) {
      throw new Error(`Verification failed: Expected min/max prices to be 450.00, got min=${priceRange.minPrice}, max=${priceRange.maxPrice}`);
    }
    console.log('✅ Success: Price range slider query returned correct stats.');

    console.log('🎉 ADVANCED SEARCH VERIFICATION PASSED!');

  } finally {
    // Cleanup
    await supabase.from('products').delete().eq('id', testProduct.id);
    console.log('Done.');
  }
}

run().catch(err => {
  console.error('❌ Advanced search verification failed:', err);
  process.exit(1);
});
