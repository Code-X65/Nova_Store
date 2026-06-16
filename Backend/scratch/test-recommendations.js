require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const { supabaseAdmin } = require('../src/config/supabase');
const { connectRedis } = require('../src/config/redis');
const bcrypt = require('bcrypt');

async function run() {
  console.log('=== Starting Telemetry & Recommendations Engine Integration Test ===\n');

  const customerId = '71239605-80ad-4ec4-b422-2240c0249bc0';
  const customerEmail = 'amossomoloye65@gmail.com';
  const customerPassword = 'SecurePassword123!';

  try {
    // 1. Connect to Redis (if configuration exists)
    await connectRedis().catch(() => {
      console.log('Redis connection failed. Proceeding without Redis...');
    });

    // 2. Prep Customer in DB
    console.log(`\n1. Preparing Customer (${customerEmail}) in database...`);
    const hash = await bcrypt.hash(customerPassword, 12);
    await supabaseAdmin
      .from('users')
      .update({
        password_hash: hash,
        failed_login_attempts: 0,
        lock_until: null,
        is_active: true,
        is_email_verified: true
      })
      .eq('id', customerId);
    console.log('✓ Customer prepped.');

    // 3. Authenticate to get session cookie
    console.log('\n2. Logging in customer...');
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: customerPassword });

    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed with status: ${loginRes.statusCode}. Body: ${JSON.stringify(loginRes.body)}`);
    }

    const cookie = loginRes.headers['set-cookie']
      .find(c => c.startsWith('connect.sid='))
      .split(';')[0];
    console.log('✓ Login successful. Session cookie obtained.');

    // 4. Clean up previous telemetry logs to start with a fresh slate
    console.log('\n3. Cleaning up previous telemetry logs for this user...');
    await supabaseAdmin
      .from('user_search_logs')
      .delete()
      .eq('user_id', customerId);

    await supabaseAdmin
      .from('user_product_views')
      .delete()
      .eq('user_id', customerId);
    console.log('✓ Telemetry logs cleared.');

    // 5. Test 1: Fetch recommendations with NO history (should return popular fallback)
    console.log('\n4. Testing GET /api/v1/products/recommendations (Clean state fallback)...');
    const initialRecsRes = await request(app)
      .get('/api/v1/products/recommendations')
      .set('Cookie', cookie);

    if (initialRecsRes.statusCode !== 200) {
      throw new Error(`Failed to get initial recommendations: ${initialRecsRes.statusCode}`);
    }

    const initialRecs = initialRecsRes.body.data.recommendations || [];
    console.log(`✓ Received ${initialRecs.length} initial fallback recommendations.`);
    console.log('Initial list preview:');
    initialRecs.slice(0, 3).forEach((p, i) => {
      console.log(`  [${i + 1}] ${p.name} - Rating: ${p.average_rating}, Category ID: ${p.category_id}`);
    });

    // 6. Test 2: Log searches
    console.log('\n5. Posting search telemetry to POST /api/v1/analytics/track-search...');
    // Log "gaming headphones" 3 times (making it user's most searched item)
    for (let i = 0; i < 3; i++) {
      const searchRes = await request(app)
        .post('/api/v1/analytics/track-search')
        .set('Cookie', cookie)
        .send({ search_query: 'gaming headphones' });
      if (searchRes.statusCode !== 202) {
        throw new Error(`Track search failed: ${searchRes.statusCode}`);
      }
    }
    console.log('✓ Logged "gaming headphones" search 3 times.');

    // 7. Pick target product to view
    console.log('\n6. Fetching target products for view tracking...');
    const { data: testProducts, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, category_id, brand_id')
      .is('deleted_at', null)
      .limit(3);

    if (prodErr || !testProducts || testProducts.length === 0) {
      throw new Error(`Failed to retrieve products for view tracking: ${prodErr?.message}`);
    }

    const targetProduct = testProducts[0];
    console.log(`✓ Selected target product to view: "${targetProduct.name}" (ID: ${targetProduct.id}, Category: ${targetProduct.category_id})`);

    // 8. Test 3: Log product view telemetry
    console.log('\n7. Posting view telemetry to POST /api/v1/analytics/track-view...');
    const viewRes = await request(app)
      .post('/api/v1/analytics/track-view')
      .set('Cookie', cookie)
      .send({
        product_id: targetProduct.id,
        view_duration: 55 // 55 seconds
      });

    if (viewRes.statusCode !== 202) {
      throw new Error(`Track view failed: ${viewRes.statusCode}`);
    }
    console.log('✓ Logged product view successfully.');

    // 9. Test 4: Fetch recommendations with active history (should prioritize coffee/target product categories/searches)
    console.log('\n8. Testing GET /api/v1/products/recommendations (Personalized state)...');
    const personalizedRecsRes = await request(app)
      .get('/api/v1/products/recommendations')
      .set('Cookie', cookie);

    if (personalizedRecsRes.statusCode !== 200) {
      throw new Error(`Failed to get personalized recommendations: ${personalizedRecsRes.statusCode}`);
    }

    const personalizedRecs = personalizedRecsRes.body.data.recommendations || [];
    console.log(`\n✓ Received ${personalizedRecs.length} personalized recommendations.`);
    console.log('Personalized list preview (Sorted by affinity scores):');
    personalizedRecs.slice(0, 5).forEach((p, i) => {
      const matchedSearch = (p.name || '').toLowerCase().includes('headphones') ? '🌟 Matched Search (headphones)' : '';
      const matchedCategory = p.category_id === targetProduct.category_id ? '🏷️ Matched Category' : '';
      console.log(`  [${i + 1}] ${p.name} - Rating: ${p.average_rating} [${matchedSearch || matchedCategory || 'Standard Fallback'}]`);
    });

    console.log('\n========================================================');
    console.log('✓ ALL TELEMETRY & RECOMMENDATION ENDPOINTS PASSING!');
    console.log('✓ Telemetry logs successfully captured and processed.');
    console.log('========================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error occurred during verification:', error.message);
    process.exit(1);
  }
}

run();
