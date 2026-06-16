const { Client } = require('pg');
require('dotenv').config();

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

    console.log('Disabling Row Level Security on review_helpfulness table...');
    await client.query('ALTER TABLE review_helpfulness DISABLE ROW LEVEL SECURITY;');
    console.log('✅ RLS successfully disabled on review_helpfulness!');
  } catch (err) {
    console.error('❌ Failed to disable RLS:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
