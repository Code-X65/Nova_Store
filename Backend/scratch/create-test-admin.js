/**
 * create-test-admin.js
 * Inserts a test admin user directly via Supabase REST API (bypasses SDK slowness),
 * hashes the password, then generates a JWT.
 * 
 * Run: node scratch/create-test-admin.js
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const fs        = require('fs');
const path      = require('path');
const https     = require('https');
const crypto    = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET   = process.env.JWT_ACCESS_SECRET;

const TEST_EMAIL    = 'apitester@novatest.dev';
const TEST_PASSWORD = 'TestAdmin@2026!';

// ─── Tiny REST client ────────────────────────────────────────────────────────
function supabaseRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1' + path);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔧 Creating test admin user...');

  // 1. Check if already exists
  const check = await supabaseRequest('GET', `/users?email=eq.${encodeURIComponent(TEST_EMAIL)}&select=id,email,role`);
  if (check.status === 200 && Array.isArray(check.data) && check.data.length > 0) {
    const existing = check.data[0];
    console.log(`✅ User already exists: ${existing.id}`);
    await updateAndMintToken(existing.id);
    return;
  }

  // 2. Hash password
  console.log('🔑 Hashing password...');
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  // 3. Generate referral code
  const referralCode = crypto.randomBytes(6).toString('hex').toUpperCase();

  // 4. Insert user
  console.log('📝 Inserting user into database...');
  const insert = await supabaseRequest('POST', '/users', {
    email:              TEST_EMAIL,
    password_hash:      passwordHash,
    first_name:         'API',
    last_name:          'Tester',
    phone_number:       '+2348012345678',
    phone_country_code: '+234',
    referral_code:      referralCode,
    referral_source:    'other',
    role:               'ADMIN',
    is_email_verified:  true,
    is_active:          true,
    failed_login_attempts: 0,
  });

  if (insert.status !== 201 || !Array.isArray(insert.data) || !insert.data[0]?.id) {
    console.error('❌ Insert failed:', JSON.stringify(insert.data));
    process.exit(1);
  }

  const userId = insert.data[0].id;
  console.log(`✅ User created: ${userId}`);
  await updateAndMintToken(userId);
}

async function updateAndMintToken(userId) {
  // Ensure role is ADMIN
  await supabaseRequest('PATCH', `/users?id=eq.${userId}`, {
    role: 'ADMIN',
    is_email_verified: true,
    is_active: true,
  });
  console.log('✅ Role set to ADMIN');

  // Mint JWT
  const token = jwt.sign(
    { id: userId, email: TEST_EMAIL, role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '4h' }
  );

  const out = { token, userId, email: TEST_EMAIL, password: 'TestAdmin@2026!' };
  const outPath = path.resolve(__dirname, 'test-token.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log('\n✅ Token saved to scratch/test-token.json');
  console.log(`📋 User ID: ${userId}`);
  console.log(`📧 Email:   ${TEST_EMAIL}`);
  console.log(`🔐 Password: TestAdmin@2026!`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
  });
