require('dotenv').config();
const supabase = require('../src/config/supabase');

async function run() {
  const userId = '519d0bc0-5f3a-4084-8e88-b61f70676335';
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching addresses:', error);
    process.exit(1);
  }

  console.log('Addresses:', JSON.stringify(data, null, 2));
  process.exit(0);
}

run();
