#!/usr/bin/env node
/**
 * create-admin.js
 * ---------------
 * CLI tool to insert an admin account into the users table + user_roles.
 *
 * Usage:
 *   node src/scripts/create-admin.js <email> <password>
 */
'use strict';

require('dotenv').config();
const userModel = require('../models/user.model');
const roleModel = require('../models/role.model');
const userRoleModel = require('../models/user-role.model');

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

  // Admin password policy
  if (password.length < 12) {
    console.error('Error: Password must be at least 12 characters.');
    process.exit(1);
  }

  // Check for duplicate in users table
  const existing = await userModel.findByEmail(email);
  if (existing) {
    console.error(`Error: A user with email "${email}" already exists.`);
    process.exit(1);
  }

  // Retrieve admin role UUID
  const adminRole = await roleModel.findByName('ADMIN');
  if (!adminRole) {
    console.error('Error: ADMIN role not found in database. Run migrations first.');
    process.exit(1);
  }

  console.log('Creating admin account in users table…');

  // Create the user (hashes password internally)
  const user = await userModel.create({
    email,
    password,
    first_name: 'System',
    last_name: 'Admin'
  });

  // Verify email, activate user, and set main role column
  await userModel.update(user.id, {
    is_email_verified: true,
    role: 'ADMIN',
    is_active: true
  });

  // Associate role
  await userRoleModel.assignRole(user.id, adminRole.id, null);

  console.log(`\n✅ Admin created successfully.`);
  console.log(`   ID:    ${user.id}`);
  console.log(`   Email: ${user.email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message || err);
  process.exit(1);
});

