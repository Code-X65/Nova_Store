require('dotenv').config();
const supabase = require('../src/config/supabase');

async function run() {
  const email = 'amossomoloye65@gmail.com';
  const { data, error } = await supabase
    .from('users')
    .select('id, email, is_active, is_email_verified')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user:', error);
    process.exit(1);
  }

  console.log('User found:', data);
  process.exit(0);
}

run();
