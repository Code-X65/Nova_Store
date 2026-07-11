const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:\\Users\\amoss\\OneDrive\\Desktop\\Nova_Store\\Backend\\.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function countRows(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`Error counting ${table}:`, error.message);
    return null;
  }
  return count;
}

async function gatherData() {
  console.log('Gathering store statistics...');
  
  const tables = [
    'users',
    'products',
    'product_categories',
    'brands',
    'orders',
    'product_variants',
    'category_attributes'
  ];

  for (const table of tables) {
    const count = await countRows(table);
    console.log(`- ${table}: ${count}`);
  }
}

gatherData();
