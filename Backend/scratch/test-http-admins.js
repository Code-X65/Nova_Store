require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: userRoles } = await supabase.from('user_roles')
    .select('user_id, roles(name)')
    .eq('roles.name', 'STORE_OWNER');
    
  if (!userRoles || userRoles.length === 0) {
    console.log('No STORE_OWNER found');
    return;
  }
  
  const userId = userRoles[0].user_id;
  const secrets = process.env.JWT_ACCESS_SECRET.split(',');
  const token = jwt.sign({ id: userId }, secrets[0], { expiresIn: '1h' });
  
  try {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch('http://localhost:5000/api/v1/admin', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const body = await res.json();
    console.log('Status:', res.status);
    console.log('Sample Admin:', body.data?.admins?.[0]);
  } catch(err) {
    console.error('Fetch error:', err);
  }
}
run();
