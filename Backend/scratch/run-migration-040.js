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

    const sqlPath = path.join(__dirname, '../sql/040_relax_user_references.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 040 (Relaxing user foreign key constraints)...');
    await client.query(sql);
    console.log('✅ Migration 040 applied successfully!');
    console.log('');
    console.log('Changes applied:');
    console.log('  • dropped users(id) foreign key references for category, brand, product, setting, role, and order tables (allowing admin UUIDs)');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
