require('dotenv').config();
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('=== Customer Authenticated Multi-Product Cart Test ===\n');

  const userId = '519d0bc0-5f3a-4084-8e88-b61f70676335';

  try {
    // 1. Verify user exists
    console.log(`1. Verifying user ID "${userId}" exists...`);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`);
    }
    console.log(`✓ User Found: ${user.email} (Role: ${user.role})`);

    // 2. Generate token
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Fetch 3 random active products
    console.log('\n2. Fetching 3 distinct products from the database...');
    const { data: products, error: productsErr } = await supabase
      .from('products')
      .select('id, name, price, sale_price, stock_quantity')
      .is('deleted_at', null)
      .limit(3);

    if (productsErr || !products || products.length < 3) {
      throw new Error(`Failed to fetch enough products: ${productsErr?.message || 'found less than 3'}`);
    }

    console.log('✓ Found 3 products for testing:');
    products.forEach((p, index) => {
      console.log(`  [${index + 1}] ID: ${p.id} | Name: "${p.name}" | Price: $${p.sale_price || p.price}`);
    });

    // 4. Add each product to the cart
    console.log('\n3. Adding products to the shopping cart...');
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = i + 1; // Add 1 unit of product 1, 2 of product 2, 3 of product 3
      console.log(`   -> Adding ${quantity} unit(s) of "${product.name}"...`);
      
      const addRes = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId: product.id,
          quantity: quantity
        });

      if (addRes.statusCode !== 200) {
        console.error('Error Response:', JSON.stringify(addRes.body, null, 2));
        throw new Error(`Failed to add product ${product.id} to cart. Status: ${addRes.statusCode}`);
      }
    }
    console.log('✓ All products added successfully.');

    // 5. Retrieve final cart details
    console.log('\n4. GET /api/v1/cart (Verifying final cart contents)...');
    const getRes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${accessToken}`);

    if (getRes.statusCode !== 200) {
      throw new Error(`Failed to retrieve final cart. Status: ${getRes.statusCode}`);
    }

    const cart = getRes.body.data.cart;
    console.log('✓ Final Cart Details:');
    console.log(`  Cart ID: ${cart.id}`);
    console.log(`  Total Distinct Items: ${cart.items.length}`);
    console.log(`  Total Items Quantity: ${cart.itemCount}`);
    console.log(`  Cart Subtotal: $${cart.subtotal}`);
    
    console.log('  Items in cart:');
    cart.items.forEach((item, index) => {
      console.log(`    [${index + 1}] Name: "${item.product?.name}" | Qty: ${item.quantity} | Unit Price: $${item.unitPrice} | Item Total: $${item.total}`);
    });

    console.log('\n=== Multi-Product Cart Test Completed Successfully ===');
  } catch (error) {
    console.error('\n✗ Test Failed:', error.message);
    process.exit(1);
  }

  // Graceful exit for async handles on Windows
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

run();
