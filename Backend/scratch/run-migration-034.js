const { Client } = require('../node_modules/pg');
const fs = require('fs');
const path = require('path');

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

    const sqlPath = path.join(__dirname, '../sql/034_admin_lockout_and_audit.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 034...');
    await client.query(sql);
    console.log('Migration 034 applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
