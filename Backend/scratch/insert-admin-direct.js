/**
 * insert-admin-direct.js
 * Inserts a test admin user directly via the project's Supabase client.
 * Bypasses registration/email flow entirely.
 * 
 * Run: node scratch/insert-admin-direct.js
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabase = require('../src/config/supabase');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');

const EMAIL    = 'apitestadmin@novatest.dev';
const PASSWORD = 'TestAdmin@2026!';

async function main() {
  console.log('Checking connection to Supabase...');

  // 1. Check if user already exists
  const { data: existing, error: findErr } = await supabase
    .from('users')
    .select('id, email, role, is_email_verified, is_active')
    .eq('email', EMAIL)
    .maybeSingle();

  if (findErr) {
    console.error('ERROR finding user:', findErr.message);
    process.exit(1);
  }

  let userId;

  if (existing) {
    console.log(`User already exists: ${existing.id}`);
    userId = existing.id;

    // Ensure it's admin
    const { error: updErr } = await supabase
      .from('users')
      .update({ role: 'ADMIN', is_email_verified: true, is_active: true })
      .eq('id', userId);

    if (updErr) console.warn('Update role warning:', updErr.message);
    else console.log('Role ensured: ADMIN');
  } else {
    console.log('Creating new test admin user...');

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const referralCode = crypto.randomBytes(6).toString('hex').toUpperCase();

    const { data: newUser, error: insertErr } = await supabase
      .from('users')
      .insert({
        email:               EMAIL,
        password_hash:       passwordHash,
        first_name:          'APITest',
        last_name:           'Admin',
        phone_number:        '+2348000000001',
        phone_country_code:  '+234',
        referral_code:       referralCode,
        referral_source:     'other',
        referral_source_other: 'developer-test',
        role:                'ADMIN',
        is_email_verified:   true,
        is_active:           true,
        failed_login_attempts: 0,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('INSERT FAILED:', insertErr.message, insertErr.details);
      process.exit(1);
    }

    userId = newUser.id;
    console.log(`Created user: ${userId}`);
  }

  // 2. Mint a JWT directly
  const token = jwt.sign(
    { id: userId, email: EMAIL, role: 'ADMIN' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '4h' }
  );

  const out = { token, userId, email: EMAIL, password: PASSWORD };
  const outPath = path.resolve(__dirname, 'test-token.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(`\nJWT saved to scratch/test-token.json`);
  console.log(`User ID:  ${userId}`);
  console.log(`Email:    ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
