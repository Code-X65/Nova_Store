/**
 * seed-admin-role.js
 * Assigns the ADMIN role in user_roles for our test admin user.
 * Also seeds the ADMIN role in roles table if it doesn't exist.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { supabaseAdmin } = require('../src/config/supabase');

const TEST_USER_ID = '845ddade-98b0-46c6-bfe7-de41d56dfdee';

async function main() {
  console.log('Checking roles table...');

  // 1. Find or create the ADMIN role
  let { data: role, error: roleErr } = await supabaseAdmin
    .from('roles')
    .select('id, name')
    .eq('name', 'ADMIN')
    .maybeSingle();

  if (roleErr) { console.error('roles query error:', roleErr.message); process.exit(1); }

  if (!role) {
    console.log('ADMIN role not found, creating...');
    const { data: newRole, error: createErr } = await supabaseAdmin
      .from('roles')
      .insert({ name: 'ADMIN', description: 'Store Administrator' })
      .select()
      .single();
    if (createErr) { console.error('create role error:', createErr.message); process.exit(1); }
    role = newRole;
    console.log(`Created ADMIN role: ${role.id}`);
  } else {
    console.log(`ADMIN role exists: ${role.id}`);
  }

  // 2. Assign role to test user (upsert)
  const { error: urErr } = await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: TEST_USER_ID, role_id: role.id }, { onConflict: 'user_id,role_id', ignoreDuplicates: true });

  if (urErr) {
    console.warn('user_roles upsert warning (may already exist):', urErr.message);
  } else {
    console.log(`Assigned ADMIN role to user ${TEST_USER_ID}`);
  }

  // 3. Also make sure SUPER_ADMIN role exists (needed for permissions check)
  let { data: saRole } = await supabaseAdmin
    .from('roles')
    .select('id, name')
    .eq('name', 'SUPER_ADMIN')
    .maybeSingle();

  if (!saRole) {
    const { data: newSA } = await supabaseAdmin
      .from('roles')
      .insert({ name: 'SUPER_ADMIN', description: 'Super Administrator' })
      .select()
      .single();
    saRole = newSA;
    console.log('Created SUPER_ADMIN role');
  }

  // 4. Assign SUPER_ADMIN to test user so they get ['*'] permissions
  const { error: saErr } = await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: TEST_USER_ID, role_id: saRole.id }, { onConflict: 'user_id,role_id', ignoreDuplicates: true });

  if (saErr) {
    console.warn('SUPER_ADMIN assign warning:', saErr.message);
  } else {
    console.log('Assigned SUPER_ADMIN role -- will get wildcard permissions');
  }

  // 5. Update users.role field to SUPER_ADMIN
  const { error: updErr } = await supabaseAdmin
    .from('users')
    .update({ role: 'SUPER_ADMIN' })
    .eq('id', TEST_USER_ID);

  if (updErr) console.warn('update role field warning:', updErr.message);
  else console.log('users.role set to SUPER_ADMIN');

  console.log('\nDone. The test admin now has SUPER_ADMIN privileges.');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('FATAL:', err.message); process.exit(1); });
