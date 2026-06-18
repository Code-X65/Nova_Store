/**
 * seed-superadmin.js
 *
 * One-time bootstrap script: promotes the first (or configured) admin user to SUPER_ADMIN.
 * Safe to run multiple times — checks for an existing SUPER_ADMIN before acting.
 *
 * Usage:
 *   node src/scripts/seed-superadmin.js
 *   SUPER_ADMIN_EMAIL=custom@example.com node src/scripts/seed-superadmin.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';

async function seedSuperAdmin() {
  console.log('🔍  Checking for existing SUPER_ADMIN...');

  // 1. Check if any user already has the SUPER_ADMIN role
  const { data: existing, error: existingError } = await supabase
    .from('user_roles')
    .select('id, user_id, roles(name)')
    .eq('role_id', SUPER_ADMIN_ROLE_ID)
    .limit(1);

  if (existingError) throw existingError;

  if (existing && existing.length > 0) {
    console.log(`✅  SUPER_ADMIN already exists (user_id: ${existing[0].user_id}). Nothing to do.`);
    return;
  }

  const targetEmail = process.env.SUPER_ADMIN_EMAIL;

  let targetUser = null;

  if (targetEmail) {
    console.log(`📧  Looking for user with email: ${targetEmail}`);
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('email', targetEmail)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    targetUser = data;
  }

  if (!targetUser) {
    // Fall back: find the first admin-role user
    console.log('📧  No target email set. Looking for any user with ADMIN role...');
    const { data: adminRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'ADMIN')
      .single();

    if (adminRole) {
      const { data: adminUsers } = await supabase
        .from('user_roles')
        .select('user_id, users(id, email, first_name, last_name)')
        .eq('role_id', adminRole.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (adminUsers && adminUsers.length > 0) {
        targetUser = adminUsers[0].users;
      }
    }
  }

  if (!targetUser) {
    // Last resort: find the first user in the system
    console.log('⚠️   No admin user found. Using the first registered user...');
    const { data } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    targetUser = data;
  }

  if (!targetUser) {
    throw new Error('No users found in the database. Cannot seed SUPER_ADMIN. Run user migrations first.');
  }

  // 3. Assign SUPER_ADMIN role
  console.log(`🚀  Promoting user to SUPER_ADMIN: ${targetUser.email} (id: ${targetUser.id})`);

  const { error: assignError } = await supabase
    .from('user_roles')
    .insert({
      user_id: targetUser.id,
      role_id: SUPER_ADMIN_ROLE_ID,
      created_at: new Date().toISOString()
    });

  if (assignError && assignError.code !== '23505') {
    // 23505 = unique_violation (already assigned)
    throw assignError;
  }

  // 4. Update users.role column as well for backwards compat
  await supabase
    .from('users')
    .update({ role: 'SUPER_ADMIN' })
    .eq('id', targetUser.id);

  console.log(`✅  ${targetUser.email} successfully promoted to SUPER_ADMIN.`);
  console.log('');
  console.log('Verify with SQL:');
  console.log(`  SELECT u.email, r.name FROM users u`);
  console.log(`  JOIN user_roles ur ON u.id = ur.user_id`);
  console.log(`  JOIN roles r ON ur.role_id = r.id`);
  console.log(`  WHERE r.name = 'SUPER_ADMIN';`);
}

seedSuperAdmin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌  seed-superadmin failed:', err.message);
    process.exit(1);
  });
