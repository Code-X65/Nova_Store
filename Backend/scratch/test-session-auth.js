require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('=== Starting Session-Based User Authentication Integration Test ===\n');

  const testEmail = `session-user-${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';

  try {
    // 1. Register a new user
    console.log(`1. POST /api/v1/auth/register (Registering new test user: "${testEmail}")...`);
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        firstName: 'Session',
        lastName: 'User',
        phoneNumber: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        phoneCountryCode: '+1',
        homeAddress: {
          street: '123 Main St',
          city: 'Boston',
          state: 'MA',
          postalCode: '02108',
          country: 'USA'
        },
        referralSource: 'facebook'
      });

    if (registerRes.statusCode !== 201) {
      throw new Error(`Registration failed. Status: ${registerRes.statusCode}, body: ${JSON.stringify(registerRes.body)}`);
    }
    console.log('✓ Registration successful.');

    // 2. Programmatically verify email in Supabase
    console.log('\n2. Verifying email address programmatically in Supabase...');
    const { error: verifyErr } = await supabase
      .from('users')
      .update({ is_email_verified: true })
      .eq('email', testEmail);

    if (verifyErr) {
      throw new Error(`Failed to verify email in DB: ${verifyErr.message}`);
    }
    console.log('✓ Email verified successfully in database.');

    // 3. Perform Login Request
    console.log('\n3. POST /api/v1/auth/login (Authenticating user)...');
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword
      });

    console.log(`   Status Code: ${loginRes.statusCode}`);
    console.log('   Response Body:', JSON.stringify(loginRes.body, null, 2));

    if (loginRes.statusCode !== 200) {
      throw new Error(`Login failed with status: ${loginRes.statusCode}`);
    }

    // Verify accessToken is NOT returned in response body
    if (loginRes.body.accessToken) {
      throw new Error('Test Failed: accessToken was returned in the response body but should be hidden.');
    }
    console.log('✓ Successfully confirmed that the access token is not exposed in the response body.');

    // 4. Extract session cookie (connect.sid) from headers
    const setCookieHeaders = loginRes.headers['set-cookie'] || [];
    console.log('\n4. Extracting session cookie from headers...');
    const sessionCookieHeader = setCookieHeaders.find(c => c.startsWith('connect.sid='));
    
    if (!sessionCookieHeader) {
      throw new Error('Test Failed: No session cookie (connect.sid) was set by the login endpoint.');
    }
    
    const sessionCookie = sessionCookieHeader.split(';')[0];
    console.log(`✓ Found Session Cookie: "${sessionCookie.substring(0, 20)}..."`);

    // 5. Hit protected profile endpoint using only session cookie
    console.log('\n5. GET /api/v1/user/profile (Fetching profile using session cookie)...');
    const profileRes = await request(app)
      .get('/api/v1/user/profile')
      .set('Cookie', sessionCookie);

    console.log(`   Status Code: ${profileRes.statusCode}`);
    console.log('   Response Body:', JSON.stringify(profileRes.body, null, 2));

    if (profileRes.statusCode !== 200) {
      throw new Error(`Profile lookup failed using session cookie. Status: ${profileRes.statusCode}`);
    }
    console.log('✓ Successfully authenticated and retrieved profile details using session cookie.');

    // 6. Perform Logout Request
    console.log('\n6. POST /api/v1/auth/logout (Logging out / destroying session)...');
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', sessionCookie);

    console.log(`   Status Code: ${logoutRes.statusCode}`);
    console.log('   Response Body:', JSON.stringify(logoutRes.body, null, 2));

    if (logoutRes.statusCode !== 200) {
      throw new Error(`Logout failed. Status: ${logoutRes.statusCode}`);
    }
    console.log('✓ Successfully logged out user and destroyed session.');

    // 7. Verify subsequent requests with old session cookie fail
    console.log('\n7. GET /api/v1/user/profile (Re-attempting profile lookup with destroyed session)...');
    const unauthorizedRes = await request(app)
      .get('/api/v1/user/profile')
      .set('Cookie', sessionCookie);

    console.log(`   Status Code: ${unauthorizedRes.statusCode}`);
    console.log('   Response Body:', JSON.stringify(unauthorizedRes.body, null, 2));

    if (unauthorizedRes.statusCode !== 401) {
      throw new Error(`Expected status 401 (Unauthorized) but got ${unauthorizedRes.statusCode}`);
    }
    console.log('✓ Successfully blocked request after session destruction.');

    console.log('\n=== Session-Based User Authentication Integration Test Passed Successfully ===');
  } catch (error) {
    console.error('\n✗ Test Failed:', error.message);
    process.exit(1);
  }

  // Graceful exit
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

run();
