require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const { supabaseAdmin } = require('../src/config/supabase');
const { connectRedis } = require('../src/config/redis');
const bcrypt = require('bcrypt');

async function run() {
  console.log('=== Starting Full Coupon Endpoints Verification Test ===\n');

  const userId = '71239605-80ad-4ec4-b422-2240c0249bc0';
  const email = 'amossomoloye65@gmail.com';
  const password = 'SecurePassword123!';

  const adminEmail = 'admin@novastore.com';
  const adminPassword = 'Admin.';

  try {
    // 1. Connect to Redis
    await connectRedis().catch(() => {
      console.log('Redis connection failed. Proceeding without Redis...');
    });

    // 2. Prepare customer user in database
    console.log(`\nPreparing customer user ${email} in database...`);
    const customerSalt = await bcrypt.genSalt(12);
    const customerPasswordHash = await bcrypt.hash(password, customerSalt);
    await supabaseAdmin
      .from('users')
      .update({
        password_hash: customerPasswordHash,
        failed_login_attempts: 0,
        lock_until: null,
        is_active: true,
        is_email_verified: true
      })
      .eq('id', userId);
    console.log('✓ Customer user prepped.');

    // 3. Prepare admin user in database
    console.log(`\nPreparing admin user ${adminEmail} in database...`);
    const adminSalt = await bcrypt.genSalt(12);
    const adminPasswordHash = await bcrypt.hash(adminPassword, adminSalt);
    
    const { data: existingAdmin } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', adminEmail)
      .maybeSingle();

    let adminId;
    if (existingAdmin) {
      await supabaseAdmin
        .from('admins')
        .update({
          password_hash: adminPasswordHash,
          is_active: true,
          failed_login_attempts: 0,
          lock_until: null
        })
        .eq('id', existingAdmin.id);
      adminId = existingAdmin.id;
      console.log('✓ Admin prepped.');
    } else {
      const { data: newAdmin, error: createErr } = await supabaseAdmin
        .from('admins')
        .insert([{
          email: adminEmail,
          password_hash: adminPasswordHash,
          is_active: true,
          failed_login_attempts: 0,
          lock_until: null
        }])
        .select()
        .single();
      if (createErr) throw createErr;
      adminId = newAdmin.id;
      console.log('✓ Admin prepped.');
    }

    // 4. Authenticate Customer
    console.log(`\nLogging in as Customer ${email}...`);
    const customerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });

    if (customerLoginRes.statusCode !== 200) {
      throw new Error(`Customer login failed with status: ${customerLoginRes.statusCode}`);
    }
    const customerCookie = customerLoginRes.headers['set-cookie'].find(c => c.startsWith('connect.sid=')).split(';')[0];
    console.log(`✓ Customer authenticated. Cookie: ${customerCookie.substring(0, 30)}...`);

    // 5. Authenticate Admin
    console.log(`\nLogging in as Admin ${adminEmail}...`);
    const adminLoginRes = await request(app)
      .post('/api/v1/admin/login')
      .send({ email: adminEmail, password: adminPassword });

    if (adminLoginRes.statusCode !== 200) {
      throw new Error(`Admin login failed with status: ${adminLoginRes.statusCode}. Body: ${JSON.stringify(adminLoginRes.body)}`);
    }
    const adminCookie = adminLoginRes.headers['set-cookie'].find(c => c.startsWith('connect.sid=')).split(';')[0];
    console.log(`✓ Admin authenticated. Cookie: ${adminCookie.substring(0, 30)}...`);

    // 6. Setup / Remove previous matching code to avoid conflicts
    const newCouponCode = 'ADMIN-WINTER-2026';
    await supabaseAdmin.from('coupons').delete().eq('code', newCouponCode);

    // 7. Admin: POST /api/v1/admin/coupons (Create Coupon)
    console.log(`\n[ADMIN] POST /api/v1/admin/coupons (Creating "${newCouponCode}")...`);
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() - 1);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const createCouponRes = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', adminCookie)
      .send({
        code: newCouponCode,
        type: 'fixed',
        value: 12.50,
        description: 'Winter season discount',
        min_order_amount: 60.00,
        max_discount: 12.50,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        usage_limit: 50,
        per_customer_limit: 2,
        is_active: true
      });

    if (createCouponRes.statusCode !== 201) {
      throw new Error(`Create coupon failed with status: ${createCouponRes.statusCode}. Body: ${JSON.stringify(createCouponRes.body)}`);
    }
    const createdCoupon = createCouponRes.body.data.coupon;
    console.log(`✓ Coupon created successfully. ID: ${createdCoupon.id}`);

    // 8. Admin: GET /api/v1/admin/coupons (List Coupons)
    console.log('\n[ADMIN] GET /api/v1/admin/coupons (Listing)...');
    const listRes = await request(app)
      .get('/api/v1/admin/coupons')
      .set('Cookie', adminCookie);

    if (listRes.statusCode !== 200) {
      throw new Error(`Listing failed with status: ${listRes.statusCode}`);
    }
    console.log(`✓ Coupon listing retrieved successfully. Total count: ${listRes.body.data.count}`);

    // 9. Admin: GET /api/v1/admin/coupons/:id (Get Coupon Details)
    console.log(`\n[ADMIN] GET /api/v1/admin/coupons/${createdCoupon.id} (Detail lookup)...`);
    const detailRes = await request(app)
      .get(`/api/v1/admin/coupons/${createdCoupon.id}`)
      .set('Cookie', adminCookie);

    if (detailRes.statusCode !== 200) {
      throw new Error(`Details lookup failed with status: ${detailRes.statusCode}`);
    }
    console.log(`✓ Details loaded. Description: "${detailRes.body.data.coupon?.description}"`);

    // 10. Admin: PATCH /api/v1/admin/coupons/:id (Update Coupon Details)
    console.log(`\n[ADMIN] PATCH /api/v1/admin/coupons/${createdCoupon.id} (Updating description)...`);
    const updateRes = await request(app)
      .patch(`/api/v1/admin/coupons/${createdCoupon.id}`)
      .set('Cookie', adminCookie)
      .send({
        description: 'Updated Winter season discount (Premium Exclusive)'
      });

    if (updateRes.statusCode !== 200) {
      throw new Error(`Update failed with status: ${updateRes.statusCode}. Body: ${JSON.stringify(updateRes.body)}`);
    }
    console.log(`✓ Successfully updated description to: "${updateRes.body.data.coupon?.description}"`);

    // 11. Admin: GET /api/v1/admin/coupons/:id/usage (Get Usage Analytics)
    console.log(`\n[ADMIN] GET /api/v1/admin/coupons/${createdCoupon.id}/usage (Analytics)...`);
    const analyticsRes = await request(app)
      .get(`/api/v1/admin/coupons/${createdCoupon.id}/usage`)
      .set('Cookie', adminCookie);

    if (analyticsRes.statusCode !== 200) {
      throw new Error(`Analytics failed with status: ${analyticsRes.statusCode}`);
    }
    console.log(`✓ Analytics retrieved. Total usage: ${analyticsRes.body.data.totalUsed}, Unique users: ${analyticsRes.body.data.uniqueUsers}`);

    // 12. Admin: POST /api/v1/admin/coupons/bulk-generate (Bulk Coupon Generation)
    console.log('\n[ADMIN] POST /api/v1/admin/coupons/bulk-generate (Generating 3 coupons with prefix "FLASHSALE")...');
    const bulkRes = await request(app)
      .post('/api/v1/admin/coupons/bulk-generate')
      .set('Cookie', adminCookie)
      .send({
        prefix: 'FLASHSALE',
        count: 3,
        type: 'percentage',
        value: 20.00,
        expiresAt: expiresAt.toISOString(),
        usageLimitPerCode: 5,
        minOrderAmount: 100.00
      });

    if (bulkRes.statusCode !== 201) {
      throw new Error(`Bulk generate failed with status: ${bulkRes.statusCode}. Body: ${JSON.stringify(bulkRes.body)}`);
    }
    const bulkCodes = bulkRes.body.data.codes;
    console.log(`✓ Bulk generated codes successfully: ${JSON.stringify(bulkCodes)}`);

    // 13. Customer: POST /api/v1/coupons/validate (Validating Coupon)
    console.log(`\n[CUSTOMER] POST /api/v1/coupons/validate (Validating "${newCouponCode}" at $100 cart total)...`);
    const validateRes = await request(app)
      .post('/api/v1/coupons/validate')
      .set('Cookie', customerCookie)
      .send({
        code: newCouponCode,
        cartTotal: 100.00
      });

    if (validateRes.statusCode !== 200) {
      throw new Error(`Validation failed with status: ${validateRes.statusCode}. Body: ${JSON.stringify(validateRes.body)}`);
    }
    console.log('✓ Validation successful. Calculated values:');
    console.log(`   Discount: $${validateRes.body.data.discount}`);
    console.log(`   New Total: $${validateRes.body.data.newTotal}`);

    // 14. Customer: GET /api/v1/coupons/available (Get Available Coupons)
    console.log('\n[CUSTOMER] GET /api/v1/coupons/available (Listing valid coupons)...');
    const availRes = await request(app)
      .get('/api/v1/coupons/available?minOrderAmount=120')
      .set('Cookie', customerCookie);

    if (availRes.statusCode !== 200) {
      throw new Error(`Available list retrieval failed with status: ${availRes.statusCode}`);
    }
    const availableCoupons = availRes.body.data.coupons || [];
    console.log(`✓ Found ${availableCoupons.length} available coupons. Codes: ${JSON.stringify(availableCoupons.map(c => c.code))}`);

    // 15. Customer: GET /api/v1/coupons/my (Get Coupon History)
    console.log('\n[CUSTOMER] GET /api/v1/coupons/my (Usage history)...');
    const historyRes = await request(app)
      .get('/api/v1/coupons/my')
      .set('Cookie', customerCookie);

    if (historyRes.statusCode !== 200) {
      throw new Error(`History retrieval failed with status: ${historyRes.statusCode}`);
    }
    console.log(`✓ Successfully retrieved history. Count: ${historyRes.body.data.history?.length || 0}`);

    // 16. Admin: POST /api/v1/admin/coupons/:id/deactivate (Deactivating a coupon)
    console.log(`\n[ADMIN] POST /api/v1/admin/coupons/${createdCoupon.id}/deactivate (Deactivating)...`);
    const deactivateRes = await request(app)
      .post(`/api/v1/admin/coupons/${createdCoupon.id}/deactivate`)
      .set('Cookie', adminCookie);

    if (deactivateRes.statusCode !== 200) {
      throw new Error(`Deactivation failed with status: ${deactivateRes.statusCode}`);
    }
    console.log(`✓ Coupon "${newCouponCode}" successfully deactivated (soft-deleted).`);

    console.log('\n========================================================');
    console.log('✓ ALL CUSTOMER AND ADMIN ENDPOINTS TESTED SUCCESSFULLY!');
    console.log('✓ As requested, test data remains persisted in the database.');
    console.log('Persisted Coupons in Database:');
    console.log(`  - Single Coupon: "${newCouponCode}" (ID: ${createdCoupon.id}, Status: inactive/deactivated)`);
    bulkCodes.forEach((code, i) => {
      console.log(`  - Bulk Generated [${i + 1}/3]: "${code}" (Status: active)`);
    });
    console.log('========================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error occurred during coupon integration test:', error.message);
    process.exit(1);
  }
}

run();
