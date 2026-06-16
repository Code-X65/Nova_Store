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

    const sqlPath = path.join(__dirname, '../sql/041_sync_product_taxonomy_and_fixes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 041 (Sync product taxonomy, subcategory checks, soft deletes, and date attribute fixes)...');
    await client.query(sql);
    console.log('✅ Migration 041 applied successfully!');
    console.log('');
    console.log('Changes applied:');
    console.log('  • Added subcategory_id column to products');
    console.log('  • Created trg_sync_product_category_brand_slugs before trigger to sync legacy category/subcategory/brand columns');
    console.log('  • Created trg_validate_product_subcategory check trigger');
    console.log('  • Allowed and validated date attribute types');
    console.log('  • Cleaned up orphaned product attributes on category change');
    console.log('  • Handled brand/category soft delete by setting references to NULL');
    console.log('  • Redefined and ensured stock reservation, low stock, and attribute filter RPCs');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
