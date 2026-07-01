const dotenv = require('dotenv');
dotenv.config();

const supabase = require('../src/config/supabase');
const OrderModel = require('../src/models/order.model');

async function run() {
  console.log('🚀 Starting Checkout Idempotency Verification...');

  // 1. Get an existing user ID for the creator
  let targetUserId = null;
  const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
  if (!userErr && users && users.length > 0) {
    targetUserId = users[0].id;
  }
  console.log(`Using user ID: ${targetUserId}`);

  const checkoutSessionId = '00000000-1111-2222-3333-444455556666';
  
  // Clean up any stale order from previous run if any
  await supabase.from('orders').delete().eq('checkout_session_id', checkoutSessionId);

  const orderData = {
    user_id: targetUserId,
    order_number: `TEST-IDEM-${Date.now()}`,
    subtotal: 5000.00,
    shipping_cost: 500.00,
    tax_amount: 375.00,
    discount_amount: 0.00,
    total_amount: 5875.00,
    coupon_id: null,
    shipping_address: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone: '08012345678',
      street_address: '123 Test St',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria'
    },
    shipping_method: 'standard',
    customer_email: 'john@example.com',
    customer_phone: '08012345678',
    notes: 'Idempotency test order',
    checkout_session_id: checkoutSessionId
  };

  const orderItems = [
    {
      product_id: 'a9b2b524-747d-419b-b9f1-d14cfeb3b47c', // Let's look up an actual product or use a mock UUID. Wait, the DB enforces foreign key check on product_id?
      // Yes, order_items REFERENCES products(id). Let's fetch a valid product ID.
      product_name: 'Idempotency Test Item',
      sku: 'IDEM-TEST-SKU',
      quantity: 1,
      unit_price: 5000.00,
      total_price: 5000.00
    }
  ];

  const { data: products } = await supabase.from('products').select('id').limit(1);
  if (products && products.length > 0) {
    orderItems[0].product_id = products[0].id;
  }
  console.log(`Using product ID: ${orderItems[0].product_id}`);

  try {
    // 2. Call create first time
    console.log('Inserting order for the first time...');
    const order1 = await OrderModel.create(orderData, orderItems);
    console.log(`Created Order 1 ID: ${order1.id}`);

    // 3. Call create second time with exact same checkout_session_id (but different order number to check if it's skipped)
    console.log('Attempting duplicate insert (second time)...');
    const order2Data = { ...orderData, order_number: `TEST-IDEM-${Date.now()}-2` };
    const order2 = await OrderModel.create(order2Data, orderItems);
    console.log(`Created/Resolved Order 2 ID: ${order2.id}`);

    if (order1.id !== order2.id) {
      throw new Error(`Idempotency failed: Order IDs are different! (${order1.id} vs ${order2.id})`);
    }
    console.log('✅ Success: Second call returned the exact same order!');

    // 4. Verify in DB that only 1 order exists for this checkoutSessionId
    const { data: dbOrders, error: fetchErr } = await supabase
      .from('orders')
      .select('id')
      .eq('checkout_session_id', checkoutSessionId);

    if (fetchErr) throw fetchErr;
    console.log(`Number of orders found in DB: ${dbOrders.length}`);
    if (dbOrders.length !== 1) {
      throw new Error(`Verification failed: Expected 1 order, found ${dbOrders.length}`);
    }
    console.log('✅ Success: Only 1 order exists in the database.');
    console.log('🎉 IDEMPOTENCY VERIFICATION PASSED!');

  } finally {
    // 5. Cleanup
    console.log('Cleaning up test records...');
    await supabase.from('orders').delete().eq('checkout_session_id', checkoutSessionId);
    console.log('Done.');
  }
}

run().catch(err => {
  console.error('❌ Idempotency verification failed:', err);
  process.exit(1);
});
