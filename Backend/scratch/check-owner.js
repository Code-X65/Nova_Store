require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users, error } = await supabase.from('users').select('id, email, role');
  console.log('Users:', users);
  
  const { data: userRoles } = await supabase.from('user_roles').select('user_id, role_id, roles(name)');
  console.log('User Roles:', userRoles);
  
  const { data: stores } = await supabase.from('stores').select('id, name, created_by');
  console.log('Stores:', stores);
}
run();
