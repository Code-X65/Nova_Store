require('dotenv').config();
const supabase = require('../src/config/supabase');

async function run() {
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*');

  if (error) {
    console.error('Error fetching templates:', error);
    process.exit(1);
  }

  console.log('Templates in DB:', data.map(t => ({ key: t.key, subject: t.subject })));
  process.exit(0);
}

run();
