require('dotenv').config();
const supabase = require('../src/config/supabase');

async function count() {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error counting products:', error);
  } else {
    console.log(`Total products currently in the database: ${count}`);
  }
  process.exit(0);
}

count();
