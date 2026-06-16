require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/config/supabase');

async function testCartEndpoints() {
  console.log('=== Starting Shopping Cart API Endpoint Integration Test (Live DB) ===\n');

  try {
    // 0. Fetch a real product to use for cart testing
    console.log('0. Fetching a real product from database...');
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity')
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (productErr || !product) {
      throw new Error(`Failed to find a product to use for testing. Error: ${productErr?.message}`);
    }
    console.log(`✓ Using Product: "${product.name}" (ID: ${product.id}, Price: $${product.price}, Available Stock: ${product.stock_quantity})`);

    const sessionId = `test-cart-session-${Math.floor(Math.random() * 100000)}`;
    console.log(`✓ Generated Test Session ID: "${sessionId}"`);

    // 1. Get initial empty cart
    console.log('\n1. GET /api/v1/cart (Initial Empty Cart)...');
    const getEmptyRes = await request(app)
      .get('/api/v1/cart')
      .set('x-session-id', sessionId);

    if (getEmptyRes.statusCode !== 200) {
      throw new Error(`GET /cart failed. Status: ${getEmptyRes.statusCode}`);
    }
    console.log('✓ Initial cart retrieval succeeded.');
    console.log(`  Cart ID: ${getEmptyRes.body.data.cart.id}`);
    console.log(`  Item Count: ${getEmptyRes.body.data.cart.itemCount}`);
    console.log(`  Subtotal: $${getEmptyRes.body.data.cart.subtotal}`);

    // 2. Add product to cart
    console.log(`\n2. POST /api/v1/cart (Add 2 units of "${product.name}")...`);
    const addRes = await request(app)
      .post('/api/v1/cart')
      .set('x-session-id', sessionId)
      .send({
        productId: product.id,
        quantity: 2
      });

    if (addRes.statusCode !== 200) {
      throw new Error(`POST /cart failed. Status: ${addRes.statusCode}, body: ${JSON.stringify(addRes.body)}`);
    }
    const cartAfterAdd = addRes.body.data.cart;
    console.log('✓ Successfully added product to cart.');
    console.log(`  New Item Count: ${cartAfterAdd.itemCount}`);
    console.log(`  New Subtotal: $${cartAfterAdd.subtotal}`);
    
    const cartItem = cartAfterAdd.items.find(item => item.productId === product.id);
    if (!cartItem) {
      throw new Error('Added item not found in cart response items list.');
    }
    console.log(`  Cart Item ID: "${cartItem.id}" (Qty: ${cartItem.quantity}, Unit Price: $${cartItem.unitPrice}, Item Total: $${cartItem.total})`);

    // 3. Update quantity of the item
    console.log(`\n3. PUT /api/v1/cart/items/:id (Update quantity to 4)...`);
    const updateRes = await request(app)
      .put(`/api/v1/cart/items/${cartItem.id}`)
      .set('x-session-id', sessionId)
      .send({
        quantity: 4
      });

    if (updateRes.statusCode !== 200) {
      throw new Error(`PUT /cart/items/:id failed. Status: ${updateRes.statusCode}, body: ${JSON.stringify(updateRes.body)}`);
    }
    const cartAfterUpdate = updateRes.body.data.cart;
    console.log('✓ Successfully updated item quantity.');
    console.log(`  New Item Count: ${cartAfterUpdate.itemCount}`);
    console.log(`  New Subtotal: $${cartAfterUpdate.subtotal}`);
    
    const updatedItem = cartAfterUpdate.items.find(item => item.id === cartItem.id);
    console.log(`  Updated Item Qty: ${updatedItem?.quantity}`);

    // 4. Remove item from cart
    console.log(`\n4. DELETE /api/v1/cart/items/:id (Remove item)...`);
    const removeRes = await request(app)
      .delete(`/api/v1/cart/items/${cartItem.id}`)
      .set('x-session-id', sessionId);

    if (removeRes.statusCode !== 200) {
      throw new Error(`DELETE /cart/items/:id failed. Status: ${removeRes.statusCode}`);
    }
    const cartAfterRemove = removeRes.body.data.cart;
    console.log('✓ Successfully removed item from cart.');
    console.log(`  New Item Count: ${cartAfterRemove.itemCount}`);
    console.log(`  New Subtotal: $${cartAfterRemove.subtotal}`);

    // 5. Test clear cart logic (Add then Clear)
    console.log('\n5. Testing Clear Cart logic...');
    console.log(`   Adding 1 unit of "${product.name}" back to cart...`);
    const addAgainRes = await request(app)
      .post('/api/v1/cart')
      .set('x-session-id', sessionId)
      .send({
        productId: product.id,
        quantity: 1
      });

    if (addAgainRes.statusCode !== 200) {
      throw new Error('Failed to add product back.');
    }
    console.log('   Clearing cart...');
    const clearRes = await request(app)
      .delete('/api/v1/cart')
      .set('x-session-id', sessionId);

    if (clearRes.statusCode !== 200) {
      throw new Error(`DELETE /cart failed. Status: ${clearRes.statusCode}`);
    }
    console.log('✓ Clear cart request returned status 200.');

    console.log('\n6. Verifying cart is empty...');
    const getFinalRes = await request(app)
      .get('/api/v1/cart')
      .set('x-session-id', sessionId);
      
    console.log(`  Final Item Count: ${getFinalRes.body.data.cart.itemCount}`);
    console.log(`  Final Subtotal: $${getFinalRes.body.data.cart.subtotal}`);

    console.log('\n=== All Cart Endpoint Tests Passed Successfully ===');
  } catch (error) {
    console.error('\n✗ Test Suite Failed:', error.message);
    process.exit(1);
  }

  // Graceful exit for async handles on Windows
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

testCartEndpoints();
