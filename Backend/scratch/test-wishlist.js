require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/config/supabase');
const { connectRedis } = require('../src/config/redis');
const bcrypt = require('bcrypt');

async function run() {
  console.log('=== Starting Wishlist API Verification Test ===\n');

  const userId = '71239605-80ad-4ec4-b422-2240c0249bc0';
  const email = 'amossomoloye65@gmail.com';
  const password = 'SecurePassword123!';

  try {
    // 1. Connect to Redis (some middlewares or services might use it)
    await connectRedis().catch(() => {
      console.log('Redis connection failed. Proceeding without Redis...');
    });

    // 2. Verify and unlock user in the database
    console.log(`\nVerifying and preparing user ID ${userId} in the database...`);
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const { data: user, error: userErr } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        failed_login_attempts: 0,
        lock_until: null,
        is_active: true,
        is_email_verified: true
      })
      .eq('id', userId)
      .select('id, email, is_active, is_email_verified')
      .single();

    if (userErr || !user) {
      throw new Error(`User not found or update failed: ${userErr?.message || 'No user record found'}`);
    }
    console.log(`✓ User prepped & unlocked: ${user.email} (Active: ${user.is_active}, Verified: ${user.is_email_verified})`);

    // 3. Login to get the session cookie
    console.log(`\nLogging in as ${email}...`);
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });

    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed with status: ${loginRes.statusCode}. Response: ${JSON.stringify(loginRes.body)}`);
    }

    const setCookieHeaders = loginRes.headers['set-cookie'] || [];
    const sessionCookieHeader = setCookieHeaders.find(c => c.startsWith('connect.sid='));
    if (!sessionCookieHeader) {
      throw new Error('No session cookie (connect.sid) returned after login.');
    }
    const sessionCookie = sessionCookieHeader.split(';')[0];
    console.log(`✓ Authenticated successfully. Session cookie: ${sessionCookie.substring(0, 30)}...`);

    // 4. Fetch 5 active products from database to add to wishlist
    console.log('\nFetching 5 active products from database...');
    const { data: products, error: productsErr } = await supabase
      .from('products')
      .select('id, name, sku, price')
      .is('deleted_at', null)
      .limit(5);

    if (productsErr || !products || products.length < 5) {
      throw new Error(`Could not fetch 5 products: ${productsErr?.message || 'found only ' + products?.length}`);
    }
    console.log(`✓ Found 5 products to test with:`);
    products.forEach((p, idx) => console.log(`   - [${idx + 1}] "${p.name}" (ID: ${p.id})`));

    // 5. Test GET /api/v1/wishlist (Initial check)
    console.log('\nTesting GET /api/v1/wishlist (Initial check)...');
    const initialWishlistRes = await request(app)
      .get('/api/v1/wishlist')
      .set('Cookie', sessionCookie);

    if (initialWishlistRes.statusCode !== 200) {
      throw new Error(`GET /wishlist failed with status: ${initialWishlistRes.statusCode}`);
    }
    console.log('✓ GET /wishlist returned 200.');
    const initialItems = initialWishlistRes.body.data?.wishlist?.items || [];
    console.log(`  Initial wishlist items count: ${initialItems.length}`);

    // 6. Test POST /api/v1/wishlist (Adding 5 items)
    console.log('\nTesting POST /api/v1/wishlist (Adding 5 items)...');
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`   Adding product [${i + 1}/5]: "${product.name}" (ID: ${product.id})...`);
      const addRes = await request(app)
        .post('/api/v1/wishlist')
        .set('Cookie', sessionCookie)
        .send({ productId: product.id });

      if (addRes.statusCode !== 201 && addRes.statusCode !== 200) {
        throw new Error(`POST /wishlist failed for product ${product.id}. Status: ${addRes.statusCode}, body: ${JSON.stringify(addRes.body)}`);
      }
      console.log(`   ✓ Added successfully. Status: ${addRes.statusCode}`);
    }

    // 7. Test GET /api/v1/wishlist (After adding items)
    console.log('\nTesting GET /api/v1/wishlist (Verification after additions)...');
    const afterAddRes = await request(app)
      .get('/api/v1/wishlist')
      .set('Cookie', sessionCookie);

    if (afterAddRes.statusCode !== 200) {
      throw new Error(`GET /wishlist failed. Status: ${afterAddRes.statusCode}`);
    }

    const currentItems = afterAddRes.body.data?.wishlist?.items || [];
    console.log(`✓ GET /wishlist returned 200. Current wishlist items count: ${currentItems.length}`);
    
    // Ensure all 5 test products are in the wishlist items
    const wishlistProductIds = currentItems.map(item => item.product_id);
    for (const product of products) {
      if (!wishlistProductIds.includes(product.id)) {
        throw new Error(`Expected product ID ${product.id} to be in wishlist, but it was not found.`);
      }
    }
    console.log('✓ Verified all 5 products are present in the retrieved wishlist.');

    // 8. Test GET /api/v1/wishlist/:productId/check
    const testProduct = products[0];
    console.log(`\nTesting GET /api/v1/wishlist/${testProduct.id}/check...`);
    const checkRes = await request(app)
      .get(`/api/v1/wishlist/${testProduct.id}/check`)
      .set('Cookie', sessionCookie);

    if (checkRes.statusCode !== 200) {
      throw new Error(`GET /wishlist/:productId/check failed. Status: ${checkRes.statusCode}`);
    }
    console.log('Response Body:', JSON.stringify(checkRes.body, null, 2));
    if (checkRes.body.data?.inWishlist !== true) {
      throw new Error(`Expected inWishlist to be true, got ${checkRes.body.data?.inWishlist}`);
    }
    console.log('✓ Successfully verified that product is checked as IN wishlist.');

    // 9. Test DELETE /api/v1/wishlist/:productId
    console.log(`\nTesting DELETE /api/v1/wishlist/${testProduct.id}...`);
    const deleteRes = await request(app)
      .delete(`/api/v1/wishlist/${testProduct.id}`)
      .set('Cookie', sessionCookie);

    if (deleteRes.statusCode !== 200) {
      throw new Error(`DELETE /wishlist/:productId failed. Status: ${deleteRes.statusCode}`);
    }
    console.log('✓ Successfully deleted product from wishlist.');

    // 10. Verify deletion with Check endpoint
    console.log(`\nTesting GET /api/v1/wishlist/${testProduct.id}/check (Verify deleted)...`);
    const checkDeletedRes = await request(app)
      .get(`/api/v1/wishlist/${testProduct.id}/check`)
      .set('Cookie', sessionCookie);

    if (checkDeletedRes.statusCode !== 200) {
      throw new Error(`GET /wishlist/:productId/check failed. Status: ${checkDeletedRes.statusCode}`);
    }
    console.log('Response Body:', JSON.stringify(checkDeletedRes.body, null, 2));
    if (checkDeletedRes.body.data?.inWishlist !== false) {
      throw new Error(`Expected inWishlist to be false, got ${checkDeletedRes.body.data?.inWishlist}`);
    }
    console.log('✓ Successfully verified that deleted product is no longer in wishlist.');

    // 11. Re-add the deleted product to keep exactly 5 items persisted in the wishlist
    console.log(`\nRe-adding "${testProduct.name}" (ID: ${testProduct.id}) to maintain 5 items in wishlist...`);
    const finalAddRes = await request(app)
      .post('/api/v1/wishlist')
      .set('Cookie', sessionCookie)
      .send({ productId: testProduct.id });

    if (finalAddRes.statusCode !== 201 && finalAddRes.statusCode !== 200) {
      throw new Error(`Re-adding product failed. Status: ${finalAddRes.statusCode}`);
    }
    console.log('✓ Product successfully re-added.');

    // 12. Final GET verification
    console.log('\nFinal validation: Retrieving final wishlist...');
    const finalWishlistRes = await request(app)
      .get('/api/v1/wishlist')
      .set('Cookie', sessionCookie);

    const finalItems = finalWishlistRes.body.data?.wishlist?.items || [];
    console.log(`✓ Final wishlist items count: ${finalItems.length}`);
    console.log('Final wishlist items:');
    finalItems.forEach((item, index) => {
      console.log(`   - [${index + 1}] Product: "${item.product?.name}" | Price: $${item.product?.price} | SKU: ${item.product?.sku}`);
    });

    console.log('\n=== Wishlist API Verification Completed Successfully! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error occurred during wishlist test:', error.message);
    process.exit(1);
  }
}

run();
