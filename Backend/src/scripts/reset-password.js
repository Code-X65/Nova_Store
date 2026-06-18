#!/usr/bin/env node
/**
 * reset-password.js
 * -----------------
 * CLI tool to reset the password for the admin account.
 * Targets the first (and normally only) admin row in users table.
 *
 * Usage:
 *   node src/scripts/reset-password.js <newPassword>
 */
'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const userModel = require('../models/user.model');

const BCRYPT_ROUNDS = 12;

async function main() {
  const [, , newPassword] = process.argv;

  if (!newPassword) {
    console.error('Usage: node src/scripts/reset-password.js <newPassword>');
    process.exit(1);
  }

  if (newPassword.length < 12) {
    console.error('Error: Password must be at least 12 characters.');
    process.exit(1);
  }

  // Find the first admin user
  const result = await userModel.findAdmins({ page: 1, limit: 1 });
  const admin = result.admins?.[0];

  if (!admin) {
    console.error('Error: No admin account found. Run create-admin.js first.');
    process.exit(1);
  }

  console.log(`Resetting password for admin: ${admin.email}`);
  console.log('Hashing new password…');

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const updated = await userModel.update(admin.id, { password_hash });

  console.log(`\n✅ Password reset successfully.`);
  console.log(`   Email:   ${admin.email}`);
  console.log(`   Updated: ${updated.updated_at}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message || err);
  process.exit(1);
});
