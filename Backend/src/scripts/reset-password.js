#!/usr/bin/env node
/**
 * reset-password.js
 * -----------------
 * CLI tool to reset the password for the admin account.
 * Targets the first (and normally only) admin row.
 *
 * Usage:
 *   node src/scripts/reset-password.js <newPassword>
 *
 * Requires:
 *   - .env loaded (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   - At least one admin already created via create-admin.js
 */
'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const adminModel = require('../models/admin.model');

const BCRYPT_ROUNDS = 12;

async function main() {
  const [, , newPassword] = process.argv;

  if (!newPassword) {
    console.error('Usage: node src/scripts/reset-password.js <newPassword>');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('Error: Password must be at least 8 characters.');
    process.exit(1);
  }

  const admin = await adminModel.findFirst();
  if (!admin) {
    console.error('Error: No admin account found. Run create-admin.js first.');
    process.exit(1);
  }

  console.log(`Resetting password for admin: ${admin.email}`);
  console.log('Hashing new password…');

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const updated = await adminModel.updatePassword(admin.id, password_hash);

  console.log(`\n✅ Password reset successfully.`);
  console.log(`   Email:   ${admin.email}`);
  console.log(`   Updated: ${updated.updated_at}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message || err);
  process.exit(1);
});
