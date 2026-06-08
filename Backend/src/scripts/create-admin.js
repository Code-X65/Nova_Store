#!/usr/bin/env node
/**
 * create-admin.js
 * ---------------
 * One-time CLI tool to insert an admin account into the admins table.
 *
 * Usage:
 *   node src/scripts/create-admin.js <email> <password>
 *
 * Requires:
 *   - .env loaded (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   - 030_admin_auth.sql migration applied
 */
'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const adminModel = require('../models/admin.model');

const BCRYPT_ROUNDS = 12;

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error('Usage: node src/scripts/create-admin.js <email> <password>');
    process.exit(1);
  }

  // Basic email sanity check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Error: Invalid email address.');
    process.exit(1);
  }

  // Minimum password policy: 8+ chars (admins can enforce their own policy)
  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters.');
    process.exit(1);
  }

  // Check for duplicate before hashing (saves time on error)
  const existing = await adminModel.findByEmail(email);
  if (existing) {
    console.error(`Error: An admin with email "${email}" already exists.`);
    process.exit(1);
  }

  console.log('Hashing password…');
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const admin = await adminModel.create({ email, password_hash });

  console.log(`\n✅ Admin created successfully.`);
  console.log(`   ID:    ${admin.id}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   At:    ${admin.created_at}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message || err);
  process.exit(1);
});
