const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
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

    const sqlPath = path.join(__dirname, '../../sql/031_telemetry_and_recommendations.sql');
    console.log(`Reading SQL file from ${sqlPath}...`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing SQL migration script...');
    await client.query(sql);
    console.log('✅ Telemetry tables created and RLS disabled successfully!');
  } catch (err) {
    console.error('❌ Failed to run migration:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
