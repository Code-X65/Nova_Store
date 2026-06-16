require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/config/supabase');
const { connectRedis } = require('../src/config/redis');
const bcrypt = require('bcrypt');

async function run() {
  console.log('=== Starting Coupon API Endpoints Live Verification ===\n');

  const userId = '71239605-80ad-4ec4-b422-2240c0249bc0';
  const email = 'amossomoloye65@gmail.com';
  const password = 'SecurePassword123!';
  const testCouponCode = 'TEST-WELCOME-2026';

  try {
    // 1. Connect to Redis
    await connectRedis().catch(() => {
      console.log('Redis connection failed. Proceeding without Redis...');
    });

    // 2. Ensure test user is unlocked and verified
    console.log(`\n1. Preparing test user ${email} in database...`);
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        failed_login_attempts: 0,
        lock_until: null,
        is_active: true,
        is_email_verified: true
      })
      .eq('id', userId);
    console.log('✓ User prepared.');

    // 3. Login to capture the session cookie
    console.log(`\n2. Authenticating as user ${email} to get session...`);
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });

    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed with status: ${loginRes.statusCode}`);
    }

    const setCookieHeaders = loginRes.headers['set-cookie'] || [];
    const sessionCookieHeader = setCookieHeaders.find(c => c.startsWith('connect.sid='));
    if (!sessionCookieHeader) {
      throw new Error('No session cookie (connect.sid) returned after login.');
    }
    const sessionCookie = sessionCookieHeader.split(';')[0];
    console.log(`✓ Authenticated. Cookie: ${sessionCookie.substring(0, 30)}...`);

    // 4. Set up temporary coupon in database
    console.log(`\n3. Setting up temporary coupon "${testCouponCode}" in database...`);
    // Delete if it already exists
    await supabase
      .from('coupons')
      .delete()
      .eq('code', testCouponCode);

    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() - 1); // active starting yesterday
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);  // expires in 7 days

    const { data: coupon, error: couponErr } = await supabase
      .from('coupons')
      .insert([{
        code: testCouponCode,
        type: 'percentage',
        value: 15.00, // 15% discount
        description: 'Test coupon for 15% off',
        min_order_amount: 50.00,
        max_discount: 20.00,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        usage_limit: 100,
        per_customer_limit: 1,
        is_active: true
      }])
      .select()
      .single();

    if (couponErr || !coupon) {
      throw new Error(`Failed to create test coupon: ${couponErr?.message || 'No record returned'}`);
    }
    console.log(`✓ Created test coupon ID: ${coupon.id}`);

    // 5. Test POST /api/v1/coupons/validate (Valid criteria)
    console.log('\n4. Testing POST /api/v1/coupons/validate (Valid criteria)...');
    const validValRes = await request(app)
      .post('/api/v1/coupons/validate')
      .set('Cookie', sessionCookie)
      .send({
        code: testCouponCode,
        cartTotal: 100.00 // $100 cart subtotal (15% is $15 discount, below the $20 max cap)
      });

    console.log('   Response Status:', validValRes.statusCode);
    console.log('   Response Body:', JSON.stringify(validValRes.body, null, 2));

    if (validValRes.statusCode !== 200) {
      throw new Error(`Validate failed with status: ${validValRes.statusCode}`);
    }
    if (validValRes.body.data.discount !== 15 || validValRes.body.data.newTotal !== 85) {
      throw new Error(`Incorrect discount calculation: expected 15 and 85, got ${validValRes.body.data.discount} and ${validValRes.body.data.newTotal}`);
    }
    console.log('✓ Validation succeeded and calculated discount correctly.');

    // 6. Test POST /api/v1/coupons/validate (Valid criteria with max discount limit check)
    console.log('\n5. Testing POST /api/v1/coupons/validate (Max discount ceiling limit)...');
    const maxValRes = await request(app)
      .post('/api/v1/coupons/validate')
      .set('Cookie', sessionCookie)
      .send({
        code: testCouponCode,
        cartTotal: 200.00 // 15% of $200 is $30, but should be capped at max_discount ($20)
      });

    console.log('   Discount:', maxValRes.body.data.discount);
    console.log('   New Total:', maxValRes.body.data.newTotal);
    if (maxValRes.body.data.discount !== 20 || maxValRes.body.data.newTotal !== 180) {
      throw new Error(`Expected discount capped at 20 and new total 180, got ${maxValRes.body.data.discount} and ${maxValRes.body.data.newTotal}`);
    }
    console.log('✓ Correctly capped discount at max_discount limit.');

    // 7. Test POST /api/v1/coupons/validate (Below min_order_amount)
    console.log('\n6. Testing POST /api/v1/coupons/validate (Below minimum order limit)...');
    const belowMinRes = await request(app)
      .post('/api/v1/coupons/validate')
      .set('Cookie', sessionCookie)
      .send({
        code: testCouponCode,
        cartTotal: 40.00 // Below the $50 minimum order threshold
      });

    console.log('   Response Status:', belowMinRes.statusCode);
    console.log('   Response Body:', JSON.stringify(belowMinRes.body, null, 2));

    if (belowMinRes.statusCode !== 400) {
      throw new Error(`Expected status code 400 but got ${belowMinRes.statusCode}`);
    }
    const errMsg = belowMinRes.body.error?.message || '';
    if (!errMsg.includes('Minimum order amount') && !errMsg.includes('You are not eligible for this coupon')) {
      throw new Error(`Expected error message to complain about minimum order amount or eligibility, got: "${errMsg}"`);
    }
    console.log('✓ Correctly blocked validation because order total is below minimum.');

    // 8. Test GET /api/v1/coupons/available
    console.log('\n7. Testing GET /api/v1/coupons/available...');
    const availRes = await request(app)
      .get('/api/v1/coupons/available?minOrderAmount=60')
      .set('Cookie', sessionCookie);

    if (availRes.statusCode !== 200) {
      throw new Error(`GET /available failed with status: ${availRes.statusCode}`);
    }

    const couponsList = availRes.body.data.coupons || [];
    const foundCoupon = couponsList.find(c => c.code === testCouponCode);
    if (!foundCoupon) {
      throw new Error(`Expected to find "${testCouponCode}" in the available coupons list, but it was not returned.`);
    }
    console.log(`✓ Found "${testCouponCode}" in the available coupons list.`);

    // 9. Test GET /api/v1/coupons/my
    console.log('\n8. Testing GET /api/v1/coupons/my...');
    const myCouponsRes = await request(app)
      .get('/api/v1/coupons/my')
      .set('Cookie', sessionCookie);

    if (myCouponsRes.statusCode !== 200) {
      throw new Error(`GET /my failed with status: ${myCouponsRes.statusCode}`);
    }
    console.log(`✓ GET /my returned successfully. Usage log records found: ${myCouponsRes.body.data.history?.length || 0}`);

    // 10. Cleanup database
    console.log('\n9. Cleaning up temporary coupon from database...');
    const { error: deleteErr } = await supabase
      .from('coupons')
      .delete()
      .eq('id', coupon.id);

    if (deleteErr) {
      throw deleteErr;
    }
    console.log('✓ Cleanup complete.');

    console.log('\n=== All Coupon API Endpoints Verified and Fully Functional! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error occurred during coupon verification:', error.message);
    process.exit(1);
  }
}

run();
