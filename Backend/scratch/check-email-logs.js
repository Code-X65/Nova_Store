require('dotenv').config();
const supabase = require('../src/config/supabase');

async function run() {
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching email logs:', error);
    process.exit(1);
  }

  console.log('Recent Email Logs:', JSON.stringify(data, null, 2));
  process.exit(0);
}

run();
