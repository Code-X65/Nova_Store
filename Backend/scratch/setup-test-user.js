/**
 * setup-test-user-v2.js
 * Uses the app's own UserModel.create() to insert a test admin,
 * then signs a JWT with the same secret the server uses.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const userModel = require('../src/models/user.model');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const TEST_EMAIL = `apitester-${Date.now()}@novatest.dev`;
const TEST_PASSWORD = 'TestAdmin@2026!';

async function setup() {
  console.log('🔧 Creating test user via UserModel...');
  console.log(`   Email: ${TEST_EMAIL}`);

  // Create user (UserModel.create hashes the password internally)
  let user;
  try {
    user = await userModel.create({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      first_name: 'API',
      last_name: 'Tester',
      phone_number: '+2348012345678',
      phone_country_code: '+234',
      referral_source: 'other',
    });
    console.log(`✅ User created: ${user.id}`);
  } catch (err) {
    console.error('❌ Failed to create user:', err.message);
    process.exit(1);
  }

  // Mark email verified + set ADMIN role
  try {
    await userModel.update(user.id, {
      is_email_verified: true,
      is_active: true,
      role: 'ADMIN',
    });
    console.log('✅ Marked as verified + ADMIN');
  } catch (err) {
    console.warn('⚠️  Could not update user role:', err.message);
  }

  // Generate JWT (same as what the server uses)
  const token = jwt.sign(
    {
      id: user.id,
      email: TEST_EMAIL,
      role: 'ADMIN',
      roles: ['admin'],
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '2h' }
  );

  const out = { token, userId: user.id, email: TEST_EMAIL };
  const outPath = path.resolve(__dirname, 'test-token.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log('\n🔑 JWT saved to scratch/test-token.json');
  console.log(`📋 User ID: ${user.id}`);
  process.exit(0);
}

setup().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
