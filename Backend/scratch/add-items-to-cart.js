require('dotenv').config();
const supabase = require('../src/config/supabase');
const CartService = require('../src/services/cart.service');
const { connectRedis } = require('../src/config/redis');

async function run() {
  const userId = '71239605-80ad-4ec4-b422-2240c0249bc0';
  console.log(`=== Adding 10 Items to Cart of User ${userId} ===\n`);

  try {
    // 1. Connect to Redis (used by cart service caching/locks)
    await connectRedis().catch(() => {
      console.log('Redis connection failed. Proceeding without Redis cache...');
    });

    // 2. Fetch 10 active products
    console.log('1. Fetching 10 products from database...');
    const { data: products, error: productsErr } = await supabase
      .from('products')
      .select('id, name, price, sale_price, stock_quantity')
      .is('deleted_at', null)
      .limit(10);

    if (productsErr || !products || products.length < 10) {
      throw new Error(`Could not fetch 10 products: ${productsErr?.message || 'found only ' + products?.length}`);
    }

    console.log(`✓ Found ${products.length} products to add.`);

    // 3. Add products to user's cart
    console.log('\n2. Adding items to cart sequentially...');
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`   [${i + 1}/10] Adding 1 unit of "${product.name}" (ID: ${product.id})...`);
      
      await CartService.addItem(userId, null, product.id, null, 1);
    }
    console.log('✓ Successfully added all 10 products.');

    // 4. Fetch the final cart to verify
    console.log('\n3. Retrieving final cart details...');
    const cart = await CartService.getOrCreateCart(userId, null);
    
    console.log(`✓ Cart ID: ${cart.id}`);
    console.log(`✓ Total Items (Distinct): ${cart.items.length}`);
    console.log(`✓ Total Items (Quantity): ${cart.itemCount}`);
    console.log(`✓ Cart Subtotal: $${cart.subtotal}`);
    
    console.log('\nItems list:');
    cart.items.forEach((item, index) => {
      console.log(`   - [${index + 1}] SKU: ${item.product?.sku} | Qty: ${item.quantity} | Unit Price: $${item.unitPrice} | Total: $${item.total} | Name: "${item.product?.name}"`);
    });

    console.log('\n=== Cart population completed successfully! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error occurred:', error.message);
    process.exit(1);
  }
}

run();
