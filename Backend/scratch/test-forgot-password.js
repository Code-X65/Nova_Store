require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('=== Starting Forgot Password API Endpoint Integration Test ===\n');

  try {
    // 1. Test non-existent email
    const fakeEmail = `nonexistent-user-${Date.now()}@example.com`;
    console.log(`1. Testing forgot-password with non-existent email: "${fakeEmail}"...`);
    
    const fakeRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: fakeEmail });

    console.log(`   Status Code: ${fakeRes.statusCode}`);
    console.log('   Response Body:', JSON.stringify(fakeRes.body, null, 2));

    if (fakeRes.statusCode !== 404) {
      throw new Error(`Expected status code 404 but got ${fakeRes.statusCode}`);
    }
    if (fakeRes.body.error?.message !== 'No account found with this email address') {
      throw new Error(`Unexpected error message: "${fakeRes.body.error?.message}"`);
    }
    console.log('✓ Successfully returned 404 for non-existent email.');

    // 2. Test existing email
    const realEmail = 'amossomoloye65@gmail.com';
    console.log(`\n2. Testing forgot-password with existing email: "${realEmail}"...`);

    const realRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: realEmail });

    console.log(`   Status Code: ${realRes.statusCode}`);
    console.log('   Response Body:', JSON.stringify(realRes.body, null, 2));

    if (realRes.statusCode !== 200) {
      throw new Error(`Expected status code 200 but got ${realRes.statusCode}`);
    }
    if (realRes.body.message !== 'Password reset link has been sent to your email address.') {
      throw new Error(`Unexpected success message: "${realRes.body.message}"`);
    }
    console.log('✓ Successfully returned 200 and success message for existing email.');

    // 3. Verify that the email log was recorded in Supabase (with status sent or failed)
    console.log('\n3. Verifying email delivery logs in database...');
    const { data: logs, error: logError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('recipient_email', realEmail)
      .eq('template_key', 'password_reset')
      .order('created_at', { ascending: false })
      .limit(1);

    if (logError) {
      throw logError;
    }

    if (logs.length === 0) {
      throw new Error('No email log was recorded for the password reset.');
    }

    const latestLog = logs[0];
    console.log(`   Latest Email Log Status: "${latestLog.status}"`);
    console.log(`   Logged At: ${latestLog.created_at}`);
    
    if (latestLog.status !== 'sent') {
      throw new Error(`Expected email status "sent" but got "${latestLog.status}". Error details: ${latestLog.error}`);
    }

    console.log('\n=== Forgot Password API Endpoint Tests Passed Successfully ===');
  } catch (error) {
    console.error('\n✗ Test Failed:', error.message);
    process.exit(1);
  }

  // Graceful exit for async handles on Windows
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

run();
