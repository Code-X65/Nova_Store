require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const { supabaseAdmin } = require('../src/config/supabase');
const { connectRedis } = require('../src/config/redis');
const bcrypt = require('bcrypt');

async function run() {
  console.log('=== Starting Product Review & Flag Reporting Integration Test ===\n');

  const customerAId = '71239605-80ad-4ec4-b422-2240c0249bc0';
  const customerAEmail = 'amossomoloye65@gmail.com';
  const customerAPassword = 'SecurePassword123!';

  const customerBEmail = 'reporter-user@example.com';
  const customerBPassword = 'SecurePassword123!';

  const adminEmail = 'admin@novastore.com';
  const adminPassword = 'Admin.';

  try {
    // 1. Connect to Redis
    await connectRedis().catch(() => {
      console.log('Redis connection failed. Proceeding without Redis...');
    });

    // 2. Prep Customer A
    console.log(`\n1. Preparing Customer A (${customerAEmail}) in database...`);
    const hashA = await bcrypt.hash(customerAPassword, 12);
    await supabaseAdmin
      .from('users')
      .update({
        password_hash: hashA,
        failed_login_attempts: 0,
        lock_until: null,
        is_active: true,
        is_email_verified: true
      })
      .eq('id', customerAId);
    console.log('✓ Customer A prepped.');

    // 3. Prep Customer B (Reporter)
    console.log(`\n2. Preparing Customer B (${customerBEmail}) in database...`);
    const { data: existingB } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', customerBEmail)
      .maybeSingle();

    let customerBId;
    const hashB = await bcrypt.hash(customerBPassword, 12);

    if (existingB) {
      await supabaseAdmin
        .from('users')
        .update({
          password_hash: hashB,
          failed_login_attempts: 0,
          lock_until: null,
          is_active: true,
          is_email_verified: true
        })
        .eq('id', existingB.id);
      customerBId = existingB.id;
      console.log('✓ Customer B prepped (Updated).');
    } else {
      const { data: newB, error: registerErr } = await supabaseAdmin
        .from('users')
        .insert([{
          email: customerBEmail,
          password_hash: hashB,
          first_name: 'Reporter',
          last_name: 'Customer',
          is_email_verified: true,
          is_active: true,
          referral_code: 'REPORTERUSER'
        }])
        .select()
        .single();
      if (registerErr) throw registerErr;
      customerBId = newB.id;
      console.log('✓ Customer B prepped (Created).');
    }

    // 4. Prep Admin
    console.log(`\n3. Preparing Admin (${adminEmail}) in database...`);
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await supabaseAdmin
      .from('admins')
      .update({
        password_hash: adminHash,
        is_active: true,
        failed_login_attempts: 0,
        lock_until: null
      })
      .eq('email', adminEmail);
    console.log('✓ Admin prepped.');

    // 5. Fetch a product to review
    console.log('\n4. Fetching a product to test reviews with...');
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (prodErr || !product) {
      throw new Error(`Failed to find product for review: ${prodErr?.message}`);
    }
    console.log(`✓ Selected Product: "${product.name}" (ID: ${product.id})`);

    // Clean up previous reviews by A or B on this product to avoid UNIQUE constraints
    await supabaseAdmin
      .from('product_reviews')
      .delete()
      .eq('product_id', product.id)
      .in('user_id', [customerAId, customerBId]);

    // 6. Logins
    console.log('\n5. Logging in all entities...');
    // Login Customer A
    const loginARes = await request(app).post('/api/v1/auth/login').send({ email: customerAEmail, password: customerAPassword });
    const cookieA = loginARes.headers['set-cookie'].find(c => c.startsWith('connect.sid=')).split(';')[0];
    
    // Login Customer B
    const loginBRes = await request(app).post('/api/v1/auth/login').send({ email: customerBEmail, password: customerBPassword });
    const cookieB = loginBRes.headers['set-cookie'].find(c => c.startsWith('connect.sid=')).split(';')[0];
    
    // Login Admin
    const loginAdminRes = await request(app).post('/api/v1/admin/login').send({ email: adminEmail, password: adminPassword });
    const cookieAdmin = loginAdminRes.headers['set-cookie'].find(c => c.startsWith('connect.sid=')).split(';')[0];
    console.log('✓ All cookies obtained successfully.');

    // 7. Customer A: Add Review
    console.log(`\n6. [Customer A] Hitting POST /api/v1/reviews (Adding review for product)...`);
    const addReviewRes = await request(app)
      .post('/api/v1/reviews')
      .set('Cookie', cookieA)
      .send({
        productId: product.id,
        rating: 5,
        title: 'Outstanding Quality!',
        comment: 'This product exceeded all of my expectations. Highly recommended!'
      });

    if (addReviewRes.statusCode !== 201) {
      throw new Error(`Add review failed with status: ${addReviewRes.statusCode}. Body: ${JSON.stringify(addReviewRes.body)}`);
    }
    const review = addReviewRes.body.data.review;
    console.log(`✓ Review created. ID: ${review.id}`);

    // 8. Public GET: Get reviews for product
    console.log(`\n7. [Public] GET /api/v1/reviews/product/${product.id} (Retrieving reviews)...`);
    const getProductReviewsRes = await request(app)
      .get(`/api/v1/reviews/product/${product.id}`);

    if (getProductReviewsRes.statusCode !== 200) {
      throw new Error(`Get product reviews failed: ${getProductReviewsRes.statusCode}`);
    }
    const reviewsList = getProductReviewsRes.body.data.reviews || [];
    const foundReview = reviewsList.find(r => r.id === review.id);
    if (!foundReview) {
      throw new Error('Review was not found in the public reviews list.');
    }
    console.log(`✓ Successfully found created review in the public listing. Rating: ${foundReview.rating}, Title: "${foundReview.title}"`);

    // 9. Customer B: Vote Helpful
    console.log(`\n8. [Customer B] POST /api/v1/reviews/${review.id}/helpful (Voting helpful)...`);
    const voteRes = await request(app)
      .post(`/api/v1/reviews/${review.id}/helpful`)
      .set('Cookie', cookieB)
      .send({ isHelpful: true });

    if (voteRes.statusCode !== 200) {
      throw new Error(`Vote helpful failed: ${voteRes.statusCode}. Body: ${JSON.stringify(voteRes.body)}`);
    }
    console.log('✓ Vote recorded. User Vote:', voteRes.body.data?.userVote);

    // 10. Customer B: Flag / Report Review
    console.log(`\n9. [Customer B] POST /api/v1/review-reports (Reporting review)...`);
    const reportRes = await request(app)
      .post('/api/v1/review-reports')
      .set('Cookie', cookieB)
      .send({
        reviewId: review.id,
        reason: 'spam',
        description: 'Contains advertising words'
      });

    if (reportRes.statusCode !== 201) {
      throw new Error(`Report review failed: ${reportRes.statusCode}. Body: ${JSON.stringify(reportRes.body)}`);
    }
    const reportRecord = reportRes.body.data;
    console.log(`✓ Report submitted. Report ID: ${reportRecord.id}`);

    // 11. Customer B: GET /api/v1/review-reports/me (History)
    console.log('\n10. [Customer B] GET /api/v1/review-reports/me (Checking reporter log)...');
    const myReportsRes = await request(app)
      .get('/api/v1/review-reports/me')
      .set('Cookie', cookieB);

    if (myReportsRes.statusCode !== 200) {
      throw new Error(`Get my reports failed: ${myReportsRes.statusCode}`);
    }
    const firstReport = myReportsRes.body.data?.[0];
    console.log(`✓ Verified reporter log. Found report ID: ${firstReport?.id} (Reason: "${firstReport?.reason}")`);

    // 12. Admin: GET /api/v1/admin/review-reports (Listing reports queue)
    console.log('\n11. [ADMIN] GET /api/v1/admin/review-reports (Listing queue)...');
    const adminReportsRes = await request(app)
      .get('/api/v1/admin/review-reports?status=pending')
      .set('Cookie', cookieAdmin);

    if (adminReportsRes.statusCode !== 200) {
      throw new Error(`Admin get reports failed: ${adminReportsRes.statusCode}`);
    }
    console.log(`✓ Queue count: ${adminReportsRes.body.data?.length || 0}`);

    // 13. Admin: GET /api/v1/admin/review-reports/summary (Counts)
    console.log('\n12. [ADMIN] GET /api/v1/admin/review-reports/summary (Report stats)...');
    const summaryRes = await request(app)
      .get('/api/v1/admin/review-reports/summary')
      .set('Cookie', cookieAdmin);

    if (summaryRes.statusCode !== 200) {
      throw new Error(`Admin get summary failed: ${summaryRes.statusCode}`);
    }
    console.log('✓ Stats summary data:', JSON.stringify(summaryRes.body.data, null, 2));

    // 14. Admin: PATCH /api/v1/admin/review-reports/:id (Resolving Report)
    console.log(`\n13. [ADMIN] PATCH /api/v1/admin/review-reports/${reportRecord.id} (Resolving report)...`);
    const resolveRes = await request(app)
      .patch(`/api/v1/admin/review-reports/${reportRecord.id}`)
      .set('Cookie', cookieAdmin)
      .send({
        status: 'resolved',
        adminNote: 'Report confirmed. Review content violates guidelines.'
      });

    if (resolveRes.statusCode !== 200) {
      throw new Error(`Resolve report failed: ${resolveRes.statusCode}. Body: ${JSON.stringify(resolveRes.body)}`);
    }
    console.log(`✓ Report resolved successfully. Status: "${resolveRes.body.data?.status}"`);

    // 15. Admin: PATCH /api/v1/admin/reviews/:id (Moderate/Hide Review)
    console.log(`\n14. [ADMIN] PATCH /api/v1/admin/reviews/${review.id} (Hiding review)...`);
    const moderateRes = await request(app)
      .patch(`/api/v1/admin/reviews/${review.id}`)
      .set('Cookie', cookieAdmin)
      .send({ status: 'hidden' });

    if (moderateRes.statusCode !== 200) {
      throw new Error(`Moderate review failed: ${moderateRes.statusCode}`);
    }
    console.log('✓ Review moderated. Msg:', moderateRes.body.message);

    console.log('\n========================================================');
    console.log('✓ ALL PRODUCT REVIEW & USER REPORTING ENDPOINTS PASSING!');
    console.log('✓ Test data remains persisted in the database:');
    console.log(`  - Moderated Review ID: ${review.id} (Status: hidden)`);
    console.log(`  - Resolved Report ID: ${reportRecord.id} (Status: resolved)`);
    console.log('========================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error occurred during review/reporting verification:', error.message);
    process.exit(1);
  }
}

run();
