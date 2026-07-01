const dotenv = require('dotenv');
dotenv.config();

const ReviewService = require('../src/services/review.service');
const ProductModel = require('../src/models/product.model');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('🚀 Starting Review Auto-Verification Auto-Detect Verification...');

  // 1. Get user ID
  let targetUserId = null;
  const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
  if (!userErr && users && users.length > 0) {
    targetUserId = users[0].id;
  }
  console.log(`Using target user ID: ${targetUserId}`);

  // 2. Create test product
  console.log('Creating test product...');
  const testProduct = await ProductModel.create({
    sku: `TEST-REV-${Date.now()}`,
    name: 'Review Auto Detect Test Product',
    slug: `review-auto-detect-test-product-${Date.now()}`,
    category: 'electronics',
    price: 300.00,
    stock_quantity: 10,
    track_inventory: true,
    created_by: targetUserId
  });
  console.log(`Created Product ID: ${testProduct.id}`);

  try {
    // 3. Create mock delivered order with this product
    console.log('Creating mock delivered order for user...');
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert([{
        user_id: targetUserId,
        order_number: `TEST-ORD-REV-${Date.now()}`,
        status: 'delivered',
        payment_status: 'paid',
        subtotal: 300.00,
        shipping_cost: 0.00,
        tax_amount: 0.00,
        discount_amount: 0.00,
        total_amount: 300.00,
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
        checkout_session_id: '00000000-0000-0000-0000-000000000001'
      }])
      .select()
      .single();
    if (orderErr) throw orderErr;
    console.log(`Created Order ID: ${order.id}`);

    // Insert order item
    const { error: itemErr } = await supabase
      .from('order_items')
      .insert([{
        order_id: order.id,
        product_id: testProduct.id,
        product_name: testProduct.name,
        sku: testProduct.sku,
        quantity: 1,
        unit_price: 300.00,
        total_price: 300.00
      }]);
    if (itemErr) throw itemErr;

    // 4. Submit review without orderId
    console.log('Submitting product review without orderId...');
    const reviewData = {
      productId: testProduct.id,
      rating: 5,
      title: 'Amazing purchase!',
      comment: 'Highly recommended!'
    };
    const review = await ReviewService.addReview(targetUserId, reviewData);
    console.log(`Created Review ID: ${review.id}`);
    console.log(`is_verified_purchase value: ${review.is_verified_purchase}`);

    // Assert that review was marked verified
    if (review.is_verified_purchase !== true) {
      throw new Error('Verification failed: review should be automatically marked as verified purchase!');
    }
    console.log('✅ Success: Review auto-marked as verified purchase successfully.');

    // 5. Submit review for a product the user didn't purchase (should be false)
    console.log('Testing review for unpurchased product (should be false)...');
    const testUnpurchasedProduct = await ProductModel.create({
      sku: `TEST-REV-UN-${Date.now()}`,
      name: 'Unpurchased Product',
      slug: `unpurchased-product-${Date.now()}`,
      category: 'electronics',
      price: 100.00,
      stock_quantity: 10,
      track_inventory: true,
      created_by: targetUserId
    });

    try {
      const unReview = await ReviewService.addReview(targetUserId, {
        productId: testUnpurchasedProduct.id,
        rating: 4,
        title: 'Okay product',
        comment: 'Did not buy though.'
      });
      console.log(`Unpurchased Review ID: ${unReview.id}`);
      console.log(`is_verified_purchase value: ${unReview.is_verified_purchase}`);

      if (unReview.is_verified_purchase !== false) {
        throw new Error('Verification failed: review for unpurchased product was incorrectly marked as verified purchase');
      }
      console.log('✅ Success: Review for unpurchased product correctly set to false.');

      // Cleanup unpurchased review
      await supabase.from('product_reviews').delete().eq('id', unReview.id);
    } finally {
      await supabase.from('products').delete().eq('id', testUnpurchasedProduct.id);
    }

    // Cleanup review
    await supabase.from('product_reviews').delete().eq('id', review.id);
    // Cleanup order/order_items
    await supabase.from('orders').delete().eq('id', order.id);

    console.log('🎉 REVIEW AUTO-VERIFICATION VERIFICATION PASSED!');

  } finally {
    if (testProduct.id) {
      await supabase.from('products').delete().eq('id', testProduct.id);
    }
    console.log('Done.');
  }
}

run().catch(err => {
  console.error('❌ Review verification failed:', err);
  process.exit(1);
});
