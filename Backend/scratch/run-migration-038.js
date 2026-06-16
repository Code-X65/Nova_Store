const { Client } = require('../node_modules/pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL database');

    const sqlPath = path.join(__dirname, '../sql/038_add_oauth_providers.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 038...');
    await client.query(sql);
    console.log('Migration 038 applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
