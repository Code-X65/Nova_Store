const adminModel = require('../src/models/admin.model');
const adminAuthService = require('../src/services/admin-auth.service');
const bcrypt = require('bcrypt');

async function test() {
  const email = 'test-security-admin@novastore.com';
  console.log('Cleaning up existing test admin if any...');
  const { supabaseAdmin } = require('../src/config/supabase');
  await supabaseAdmin.from('admins').delete().eq('email', email);

  console.log('Creating test admin...');
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('Password123!', salt);
  const admin = await adminModel.create({ email, password_hash: passwordHash });
  console.log('Created admin:', admin);

  console.log('Attempting bad password 1...');
  try {
    await adminAuthService.login(email, 'wrong-pass', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  } catch (err) {
    console.log('Attempt 1 failed as expected:', err.message);
  }

  let state = await adminModel.findByEmail(email);
  console.log('Current attempts:', state.failed_login_attempts, 'Lock until:', state.lock_until);

  console.log('Attempting bad password 2...');
  try {
    await adminAuthService.login(email, 'wrong-pass', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  } catch (err) {
    console.log('Attempt 2 failed as expected:', err.message);
  }

  state = await adminModel.findByEmail(email);
  console.log('Current attempts:', state.failed_login_attempts, 'Lock until:', state.lock_until);

  console.log('Attempting bad password 3...');
  try {
    await adminAuthService.login(email, 'wrong-pass', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  } catch (err) {
    console.log('Attempt 3 failed as expected:', err.message);
  }

  state = await adminModel.findByEmail(email);
  console.log('Current attempts:', state.failed_login_attempts, 'Lock until:', state.lock_until);

  console.log('Attempting login while locked (should fail fast)...');
  try {
    await adminAuthService.login(email, 'Password123!', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  } catch (err) {
    console.log('Login while locked failed as expected:', err.message);
  }

  console.log('Checking that User-Agent and IP were logged in admin_auth_logs...');
  const { data: logs } = await supabaseAdmin
    .from('admin_auth_logs')
    .select('*')
    .eq('email_attempted', email)
    .order('created_at', { ascending: false });
  console.log('Found logs:', logs.map(l => ({ ip: l.ip_address, ua: l.user_agent, success: l.success })));

  console.log('Force resetting attempts in DB to test successful login...');
  await supabaseAdmin.from('admins').update({ failed_login_attempts: 0, lock_until: null }).eq('id', admin.id);

  console.log('Attempting successful login...');
  const loggedIn = await adminAuthService.login(email, 'Password123!', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  console.log('Successful login returned admin:', loggedIn);

  state = await adminModel.findByEmail(email);
  console.log('Attempts after success:', state.failed_login_attempts);

  console.log('Testing deactivated account...');
  await supabaseAdmin.from('admins').update({ is_active: false }).eq('id', admin.id);
  try {
    await adminAuthService.login(email, 'Password123!', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  } catch (err) {
    console.log('Deactivated login failed as expected:', err.message);
  }

  console.log('Cleaning up...');
  await supabaseAdmin.from('admins').delete().eq('email', email);
  console.log('Done!');
}

test().catch(console.error);
