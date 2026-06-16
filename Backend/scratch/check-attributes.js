require('dotenv').config();
const supabase = require('../src/config/supabase');

async function check() {
  const { data: attributes, error } = await supabase
    .from('category_attributes')
    .select('*');
  
  if (error) {
    console.error('Error fetching attributes:', error);
  } else {
    console.log(`Found ${attributes.length} category attribute templates in the database:`);
    console.log(JSON.stringify(attributes, null, 2));
  }
  process.exit(0);
}

check();
