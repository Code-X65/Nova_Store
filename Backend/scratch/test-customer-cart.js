require('dotenv').config();
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('=== Customer Authenticated Cart Test ===\n');

  const userId = '519d0bc0-5f3a-4084-8e88-b61f70676335';

  try {
    // 1. Verify user exists in the database
    console.log(`1. Verifying user ID "${userId}" exists...`);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error(`User not found in database: ${userError?.message || 'No record returned'}`);
    }
    console.log(`✓ User Found: ${user.email} (Role: ${user.role}, Active: ${user.is_active})`);

    // 2. Generate a valid JWT Access Token for this customer
    console.log('\n2. Generating JWT Access Token...');
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
    console.log('✓ Token generated successfully.');

    // 3. Fetch a product to add to the cart
    console.log('\n3. Fetching a real product from the database...');
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity')
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (productErr || !product) {
      throw new Error(`Failed to find a product to add to cart: ${productErr?.message}`);
    }
    console.log(`✓ Found Product: "${product.name}" (ID: ${product.id}, Price: $${product.price})`);

    // 4. Add product to the user's cart using Authorization header
    console.log(`\n4. POST /api/v1/cart (Adding 1 unit of "${product.name}" to cart)...`);
    const addRes = await request(app)
      .post('/api/v1/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        productId: product.id,
        quantity: 1
      });

    if (addRes.statusCode !== 200) {
      throw new Error(`Failed to add item to cart. Status: ${addRes.statusCode}, body: ${JSON.stringify(addRes.body)}`);
    }
    console.log('✓ Successfully added item to authenticated cart.');
    console.log(`  Cart ID: ${addRes.body.data.cart.id}`);
    console.log(`  Item Count: ${addRes.body.data.cart.itemCount}`);
    console.log(`  Subtotal: $${addRes.body.data.cart.subtotal}`);

    // 5. Fetch cart to verify it persists
    console.log('\n5. GET /api/v1/cart (Verifying cart contents)...');
    const getRes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${accessToken}`);

    if (getRes.statusCode !== 200) {
      throw new Error(`Failed to retrieve cart. Status: ${getRes.statusCode}`);
    }
    const cart = getRes.body.data.cart;
    console.log('✓ Retrieved cart successfully.');
    console.log(`  Cart items detail:`);
    cart.items.forEach(item => {
      console.log(`    - SKU: ${item.product?.sku} | Qty: ${item.quantity} | Unit Price: $${item.unitPrice} | Total: $${item.total}`);
    });

    console.log('\n=== Authenticated Cart Test Completed Successfully ===');
  } catch (error) {
    console.error('\n✗ Test Failed:', error.message);
    process.exit(1);
  }

  // Graceful exit
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

run();
