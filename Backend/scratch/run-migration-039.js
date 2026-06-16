const { Client } = require('../node_modules/pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database');

    const sqlPath = path.join(__dirname, '../sql/039_product_category_brand_fixes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 039 (Product/Category/Brand gap fixes)...');
    await client.query(sql);
    console.log('✅ Migration 039 applied successfully!');
    console.log('');
    console.log('Changes applied:');
    console.log('  • products: added thumbnail_url, currency');
    console.log('  • product_categories: added thumbnail_url, meta_title, meta_description, meta_keywords');
    console.log('  • product_brands: added thumbnail_url, website_url, meta_title, meta_description, meta_keywords');
    console.log('  • Trigger: auto-sync product_count on category assignments');
    console.log('  • Trigger: auto-sync product_count on brand (via brand_id)');
    console.log('  • Trigger: auto-sync product_count on category (via category_id)');
    console.log('  • Trigger: validate enum/number/boolean attribute values');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
