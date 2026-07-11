require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Find old role IDs
  const { data: oldRoles } = await supabase
    .from('roles')
    .select('id')
    .not('name', 'in', '("STORE_OWNER", "MANAGER", "ORDER_STAFF", "INVENTORY_STAFF")');

  if (oldRoles && oldRoles.length > 0) {
    const oldIds = oldRoles.map(r => r.id);
    
    // Delete user_roles associated with old roles
    await supabase.from('user_roles').delete().in('role_id', oldIds);
    // Delete role_permissions associated with old roles
    await supabase.from('role_permissions').delete().in('role_id', oldIds);
    // Delete invitations associated with old roles
    await supabase.from('invitations').delete().in('role_id', oldIds);
    // Finally delete old roles
    const { data, error } = await supabase.from('roles').delete().in('id', oldIds);
    
    console.log('Error?', error);
    console.log('Success!', data);
  } else {
    console.log('No old roles found');
  }
}
run();
