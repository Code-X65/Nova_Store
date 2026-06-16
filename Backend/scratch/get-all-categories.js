require('dotenv').config();
const supabase = require('../src/config/supabase');

async function list() {
  const { data: categories, error } = await supabase
    .from('product_categories')
    .select('id, name, slug, parent_id, level')
    .is('deleted_at', null);
  
  if (error) {
    console.error('Error fetching categories:', error);
  } else {
    console.log(`Total categories in database: ${categories.length}`);
    const parents = categories.filter(c => c.level === 0 || !c.parent_id);
    const children = categories.filter(c => c.level === 1 && c.parent_id);
    
    console.log('--- Subcategories (level 1) ---');
    children.forEach(c => {
      const parent = parents.find(p => p.id === c.parent_id);
      console.log(`Subcategory: "${c.name}" (ID: ${c.id}) | Parent: "${parent?.name || 'unknown'}" (ID: ${c.parent_id})`);
    });
  }
  process.exit(0);
}

list();
