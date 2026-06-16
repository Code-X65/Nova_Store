const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment variables.');
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
    console.log('Connected to Supabase database for migrations');

    // Create tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get all SQL migration files
    const sqlDir = path.join(__dirname, '../../sql');
    if (!fs.existsSync(sqlDir)) {
      throw new Error(`Migration SQL directory not found at: ${sqlDir}`);
    }

    const files = fs.readdirSync(sqlDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort alphabetically (numerically by prefix)

    if (files.length === 0) {
      console.log('No SQL migration files found.');
      return;
    }

    // Query applied migrations
    const { rows } = await client.query('SELECT migration_name FROM schema_migrations');
    const appliedMigrations = new Set(rows.map(r => r.migration_name));

    console.log(`Found ${files.length} total migrations. ${appliedMigrations.size} already applied.`);

    // Run pending migrations
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const sqlPath = path.join(sqlDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      // Use a transaction block for each migration file to ensure clean rollbacks
      await client.query('BEGIN');
      try {
        if (sql.trim()) {
          await client.query(sql);
        }
        await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✓ Migration ${file} applied successfully.`);
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(`✗ Error applying migration ${file}:`, migrationError.message);
        throw migrationError;
      }
    }

    console.log('Database schema is fully up to date!');
  } catch (err) {
    console.error('Migration runner failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
