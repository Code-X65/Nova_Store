const dotenv = require('dotenv');
dotenv.config();

const supabase = require('../src/config/supabase');
const ProductModel = require('../src/models/product.model');
const runReservationCleanup = require('../src/jobs/reservation-cleanup.job');

async function run() {
  console.log('🚀 Starting Stock Reservation Expiry Verification...');

  // 1. Find a test product
  const { data: products } = await supabase.from('products').select('*').limit(1);
  if (!products || products.length === 0) {
    throw new Error('No products in database to test with');
  }
  const product = products[0];
  const originalReserved = Number(product.reserved_quantity || 0);
  console.log(`Product ID: ${product.id}, SKU: ${product.sku}, Current Reserved: ${originalReserved}`);

  // 2. Insert an expired reservation
  const expiredTime = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago
  console.log(`Inserting expired reservation with expires_at: ${expiredTime}...`);

  const { data: resData, error: resErr } = await supabase
    .from('inventory_reservations')
    .insert([{
      product_id: product.id,
      quantity: 3,
      expires_at: expiredTime,
      checkout_session_id: 'mock_session_123'
    }])
    .select()
    .single();

  if (resErr) throw resErr;
  console.log('Expired reservation created:', resData.id);

  // Manually increment the product's reserved_quantity to simulate reservation
  const { error: updErr } = await supabase
    .from('products')
    .update({ reserved_quantity: originalReserved + 3 })
    .eq('id', product.id);
  if (updErr) throw updErr;

  try {
    // 3. Trigger cleanup
    console.log('Triggering reservation cleanup job...');
    const deletedCount = await runReservationCleanup();
    console.log('Deleted count:', deletedCount);

    if (deletedCount < 1) {
      throw new Error('Verification failed: Reservation was not deleted!');
    }

    // 4. Assert that product's reserved_quantity returned to original
    const { data: productAfter } = await supabase
      .from('products')
      .select('reserved_quantity')
      .eq('id', product.id)
      .single();

    const afterReserved = Number(productAfter.reserved_quantity || 0);
    console.log(`Post-cleanup reserved quantity: ${afterReserved}`);

    if (afterReserved !== originalReserved) {
      throw new Error(`Verification failed: Expected reserved_quantity to return to ${originalReserved}, got ${afterReserved}`);
    }

    console.log('✅ Success: Stock reservation was successfully cleaned up and stock released.');
    console.log('🎉 RESERVATION CLEANUP VERIFICATION PASSED!');

  } finally {
    // Cleanup in case of failures
    await supabase.from('inventory_reservations').delete().eq('id', resData.id);
    await supabase.from('products').update({ reserved_quantity: originalReserved }).eq('id', product.id);
    console.log('Done.');
  }
}

run().catch(err => {
  console.error('❌ Reservation cleanup verification failed:', err);
  process.exit(1);
});
