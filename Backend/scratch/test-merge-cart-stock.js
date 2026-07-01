const dotenv = require('dotenv');
dotenv.config();

const supabase = require('../src/config/supabase');
const CartService = require('../src/services/cart.service');
const ProductModel = require('../src/models/product.model');
const CartModel = require('../src/models/cart.model');
const CartItemModel = require('../src/models/cart-item.model');

async function run() {
  console.log('🚀 Starting Merge Cart Stock Validation Verification...');

  // 1. Get user ID
  let targetUserId = null;
  const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
  if (!userErr && users && users.length > 0) {
    targetUserId = users[0].id;
  }
  console.log(`Using target user ID: ${targetUserId}`);

  const guestSessionId = `session-merge-${Date.now()}`;

  // 2. Create test product with stock = 5
  console.log('Creating test product...');
  const testProduct = await ProductModel.create({
    sku: `TEST-MERGE-${Date.now()}`,
    name: 'Merge Cart Test Product',
    slug: `merge-cart-test-product-${Date.now()}`,
    category: 'electronics',
    price: 500.00,
    stock_quantity: 5,
    track_inventory: true,
    created_by: targetUserId
  });
  console.log(`Created Product ID: ${testProduct.id}`);

  try {
    // 3. Populate user cart with 3 units
    console.log('Adding 3 units to user cart...');
    await CartService.addItem(targetUserId, null, testProduct.id, null, 3);

    // 4. Populate guest cart with 3 units
    console.log('Adding 3 units to guest cart...');
    await CartService.addItem(null, guestSessionId, testProduct.id, null, 3);

    // 5. Merge carts (should throw stock error because 3 + 3 = 6 > 5)
    console.log('Merging carts (should fail with Insufficient stock)...');
    try {
      await CartService.mergeCarts(targetUserId, guestSessionId);
      throw new Error('Verification failed: Carts merged successfully, but stock limit was exceeded!');
    } catch (err) {
      console.log(`✅ Merge threw expected error: "${err.message}"`);
      if (!err.message.includes('Insufficient stock')) {
        throw new Error(`Unexpected error message during merge: ${err.message}`);
      }
    }

    // Verify user cart has only 3 units (not merged / rolled back)
    const userCart = await CartService.getOrCreateCart(targetUserId, null);
    const userItem = userCart.items.find(i => i.productId === testProduct.id);
    console.log(`User cart item quantity: ${userItem?.quantity}`);
    if (!userItem || userItem.quantity !== 3) {
      throw new Error(`Verification failed: User cart item quantity is ${userItem?.quantity || 'missing'}, expected 3`);
    }
    console.log('✅ User cart item count remained correct.');

    // Verify guest cart has only 3 units
    const guestCart = await CartService.getOrCreateCart(null, guestSessionId);
    const guestItem = guestCart.items.find(i => i.productId === testProduct.id);
    console.log(`Guest cart item quantity: ${guestItem?.quantity}`);
    if (!guestItem || guestItem.quantity !== 3) {
      throw new Error(`Verification failed: Guest cart item quantity is ${guestItem?.quantity || 'missing'}, expected 3`);
    }
    console.log('✅ Guest cart item count remained correct.');

    console.log('🎉 MERGE CART STOCK VALIDATION PASSED SUCCESSFULLY!');

  } finally {
    // Cleanup
    console.log('Cleaning up database records...');
    await CartService.clearCart(targetUserId, null);
    await CartService.clearCart(null, guestSessionId);
    if (testProduct.id) {
      await supabase.from('products').delete().eq('id', testProduct.id);
    }
    console.log('Done.');
  }
}

run().catch(err => {
  console.error('❌ Merge cart stock verification failed:', err);
  process.exit(1);
});
