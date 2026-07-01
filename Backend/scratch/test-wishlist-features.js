const dotenv = require('dotenv');
dotenv.config();

const WishlistService = require('../src/services/wishlist.service');
const WishlistModel = require('../src/models/wishlist.model');
const CartService = require('../src/services/cart.service');
const ProductModel = require('../src/models/product.model');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('🚀 Starting Wishlist Features Verification...');

  // 1. Get user ID
  let targetUserId = null;
  const { data: users, error: userErr } = await supabase.from('users').select('id').limit(1);
  if (!userErr && users && users.length > 0) {
    targetUserId = users[0].id;
  }
  console.log(`Using target user ID: ${targetUserId}`);

  // Clean any existing cart/wishlist for this test user first to start fresh
  const { data: existingCart } = await supabase.from('carts').select('id').eq('user_id', targetUserId).maybeSingle();
  if (existingCart) {
    await supabase.from('cart_items').delete().eq('cart_id', existingCart.id);
  }
  const { data: existingWishlist } = await supabase.from('wishlists').select('id').eq('user_id', targetUserId).maybeSingle();
  if (existingWishlist) {
    await supabase.from('wishlist_items').delete().eq('wishlist_id', existingWishlist.id);
  }

  // 2. Create test products
  console.log('Creating test products...');
  const prod1 = await ProductModel.create({
    sku: `TEST-WISH-A-${Date.now()}`,
    name: 'Wishlist Product A',
    slug: `wishlist-product-a-${Date.now()}`,
    category: 'electronics',
    price: 100.00,
    stock_quantity: 10,
    track_inventory: true,
    created_by: targetUserId
  });
  const prod2 = await ProductModel.create({
    sku: `TEST-WISH-B-${Date.now()}`,
    name: 'Wishlist Product B',
    slug: `wishlist-product-b-${Date.now()}`,
    category: 'electronics',
    price: 150.00,
    stock_quantity: 10,
    track_inventory: true,
    created_by: targetUserId
  });

  try {
    // 3. Test Wishlist Guest Merge
    console.log('Testing mergeWishlists (guest merge)...');
    const guestProductIds = [prod1.id, prod2.id];
    let wishlist = await WishlistService.mergeWishlists(targetUserId, guestProductIds);
    console.log('Wishlist items after merge:', wishlist.items.map(i => i.product_id));

    if (wishlist.items.length !== 2) {
      throw new Error(`Expected 2 wishlist items, got ${wishlist.items.length}`);
    }
    const hasProd1 = wishlist.items.some(i => i.product_id === prod1.id);
    const hasProd2 = wishlist.items.some(i => i.product_id === prod2.id);
    if (!hasProd1 || !hasProd2) {
      throw new Error('Wishlist merge is missing one or both guest products!');
    }
    console.log('✅ Success: Wishlist guest merge passed.');

    // 4. Test moveItemToCart
    console.log('Testing moveItemToCart (moving Product A to cart)...');
    wishlist = await WishlistService.moveItemToCart(targetUserId, prod1.id, null);
    console.log('Wishlist items after moving Product A:', wishlist.items.map(i => i.product_id));

    // Verify Product A is deleted from wishlist
    if (wishlist.items.length !== 1) {
      throw new Error(`Expected 1 wishlist item left, got ${wishlist.items.length}`);
    }
    if (wishlist.items[0].product_id !== prod2.id) {
      throw new Error(`Expected Product B to remain in wishlist, but got product: ${wishlist.items[0].product_id}`);
    }

    // Verify Product A is in the cart
    const cart = await CartService.getOrCreateCart(targetUserId);
    console.log('Cart items after moveItemToCart:', cart.items.map(i => i.productId));
    const cartItemA = cart.items.find(i => i.productId === prod1.id);
    if (!cartItemA) {
      throw new Error('Product A was not found in the cart after moveItemToCart!');
    }
    if (cartItemA.quantity !== 1) {
      throw new Error(`Expected Product A quantity in cart to be 1, got: ${cartItemA.quantity}`);
    }
    console.log('✅ Success: moveItemToCart passed.');

    // 5. Test moveAllToCart
    console.log('Testing moveAllToCart (moving remaining items to cart)...');
    wishlist = await WishlistService.moveAllToCart(targetUserId);
    console.log('Wishlist items after moveAllToCart:', wishlist.items.map(i => i.product_id));

    // Verify wishlist is completely empty
    if (wishlist.items.length !== 0) {
      throw new Error(`Expected wishlist to be empty, but got ${wishlist.items.length} items`);
    }

    // Verify both Product A and Product B are now in the cart
    const finalCart = await CartService.getOrCreateCart(targetUserId);
    console.log('Cart items after moveAllToCart:', finalCart.items.map(i => i.productId));
    const finalCartItemA = finalCart.items.find(i => i.productId === prod1.id);
    const finalCartItemB = finalCart.items.find(i => i.productId === prod2.id);

    if (!finalCartItemA || !finalCartItemB) {
      throw new Error('Move all failed: missing Product A or Product B in the final cart!');
    }
    console.log('✅ Success: moveAllToCart passed.');

    console.log('🎉 WISHLIST MIGRATION & MOVE TO CART VERIFICATION PASSED!');

  } finally {
    // Cleanup
    console.log('Cleaning up database test records...');
    const userCart = await CartService.getOrCreateCart(targetUserId);
    if (userCart && userCart.items) {
      for (const item of userCart.items) {
        if (item.productId === prod1.id || item.productId === prod2.id) {
          await supabase.from('cart_items').delete().eq('id', item.id);
        }
      }
    }

    const userWishlist = await WishlistService.getOrCreateWishlist(targetUserId);
    if (userWishlist) {
      await supabase.from('wishlist_items').delete().eq('wishlist_id', userWishlist.id);
    }

    await supabase.from('products').delete().eq('id', prod1.id);
    await supabase.from('products').delete().eq('id', prod2.id);
    console.log('Cleanup finished.');
  }
}

run().catch(err => {
  console.error('❌ Wishlist verification failed:', err);
  process.exit(1);
});
