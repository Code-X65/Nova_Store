/**
 * seed-swagger-user.js
 *
 * Seeding script to create or update the CODEX user inside the database
 * with the hashed password: MySuperSecretPassword123! and give them ADMIN role.
 *
 * Usage:
 *   node src/scripts/seed-swagger-user.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedSwaggerUser() {
  console.log('🚀 Starting Swagger user seeding...');

  const username = 'CODEX';
  const rawPassword = 'MySuperSecretPassword123!';
  
  // 1. Hash the password using bcrypt
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  // 2. Check if user already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', username)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Error checking existing user: ${checkError.message}`);
  }

  let userId;

  if (existingUser) {
    console.log(`👤 User '${username}' already exists. Updating password and permissions...`);
    userId = existingUser.id;

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        role: 'ADMIN',
        is_active: true,
        is_email_verified: true,
        first_name: 'CODEX',
        last_name: 'Swagger',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Error updating user: ${updateError.message}`);
    }
    console.log('✅ User updated successfully.');
  } else {
    console.log(`👤 User '${username}' does not exist. Creating new user...`);
    
    // Generate unique referral code (just like UserModel does)
    let referralCode = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 12; i++) {
      referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{
        email: username,
        password_hash: passwordHash,
        first_name: 'CODEX',
        last_name: 'Swagger',
        role: 'ADMIN',
        is_active: true,
        is_email_verified: true,
        referral_code: referralCode,
        failed_login_attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      throw new Error(`Error creating user: ${createError.message}`);
    }
    userId = newUser.id;
    console.log(`✅ User created successfully with ID: ${userId}`);
  }

  // 3. Assign the 'admin' role in user_roles
  console.log("🔑 Checking roles database for 'admin' role...");
  const { data: adminRole, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'admin')
    .single();

  if (roleError) {
    throw new Error(`Error fetching admin role ID: ${roleError.message}`);
  }

  const { error: assignError } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      role_id: adminRole.id
    });

  if (assignError && assignError.code !== '23505') { // 23505 = unique_violation (already assigned)
    throw new Error(`Error assigning role: ${assignError.message}`);
  }

  console.log(`✅ User roles successfully updated. Role 'admin' assigned to '${username}'.`);
  console.log('🎉 Seeding completed successfully.');
}

seedSwaggerUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  });
