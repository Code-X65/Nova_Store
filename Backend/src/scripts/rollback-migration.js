const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Rollback SQL statements for migrations that don't have down files
const MANUAL_ROLLBACKS = {
  '048_auth_logging_and_queue_hardening.sql': `
    ALTER TABLE public.admin_auth_logs DROP COLUMN IF EXISTS user_agent;
    ALTER TABLE public.admin_auth_logs DROP COLUMN IF EXISTS failure_reason;
    ALTER TABLE public.admin_auth_logs DROP COLUMN IF EXISTS user_id;
    DELETE FROM public.notification_templates WHERE key = 'email_change_verification';
    DROP INDEX IF EXISTS idx_admin_auth_logs_failure_reason;
  `,
  '047_manual_delivery_and_returns.sql': `
    DROP TABLE IF EXISTS public.delivery_dispatches CASCADE;
    ALTER TABLE public.orders DROP COLUMN IF EXISTS return_status;
    ALTER TABLE public.orders DROP COLUMN IF EXISTS return_reason;
  `,
  '046_rbac_fixes_and_templates.sql': `
    DELETE FROM public.notification_templates WHERE key IN ('admin_invitation', 'admin_lockout_alert');
  `,
  '045_superadmin_rbac_invitations.sql': `
    DROP TABLE IF EXISTS public.invitations CASCADE;
  `,
  '044_missing_features_schema.sql': `
    DROP TABLE IF EXISTS public.tax_rules CASCADE;
    DROP TABLE IF EXISTS public.currencies CASCADE;
  `,
  '043_add_idempotency_keys.sql': `
    DROP TABLE IF EXISTS public.idempotency_keys CASCADE;
  `,
  '031_telemetry_and_recommendations.sql': `
    DROP TABLE IF EXISTS public.user_search_logs CASCADE;
    DROP TABLE IF EXISTS public.user_product_views CASCADE;
  `,
  '030_registration_fields.sql': `
    ALTER TABLE public.users DROP COLUMN IF EXISTS home_address;
    ALTER TABLE public.users DROP COLUMN IF EXISTS referral_source;
    ALTER TABLE public.users DROP COLUMN IF EXISTS referred_by;
    ALTER TABLE public.users DROP COLUMN IF EXISTS is_phone_verified;
  `,
  '029_phone_verification_tokens.sql': `
    DROP TABLE IF EXISTS public.phone_verification_tokens CASCADE;
  `
};

async function rollbackMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment variables.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database for migration rollback');

    // 1. Get the last applied migration
    const res = await client.query('SELECT migration_name FROM schema_migrations ORDER BY applied_at DESC, migration_name DESC LIMIT 1');
    if (res.rows.length === 0) {
      console.log('No migrations found in schema_migrations table to roll back.');
      return;
    }

    const lastMigration = res.rows[0].migration_name;
    console.log(`Last applied migration detected: ${lastMigration}`);

    // 2. Determine the SQL to run for rollback
    let rollbackSql = '';
    const sqlDir = path.join(__dirname, '../../sql');
    
    // Check if a dedicated down file exists (e.g. 048_filename.down.sql)
    const downFileName = lastMigration.replace('.sql', '.down.sql');
    const downFilePath = path.join(sqlDir, downFileName);

    if (fs.existsSync(downFilePath)) {
      console.log(`Found down file: ${downFileName}. Reading contents...`);
      rollbackSql = fs.readFileSync(downFilePath, 'utf8');
    } else if (MANUAL_ROLLBACKS[lastMigration]) {
      console.log('No down file found. Using predefined manual rollback SQL...');
      rollbackSql = MANUAL_ROLLBACKS[lastMigration];
    } else {
      throw new Error(`No rollback script or predefined statement found for migration: ${lastMigration}`);
    }

    // 3. Execute rollback in a transaction
    console.log(`Rolling back migration: ${lastMigration}...`);
    await client.query('BEGIN');
    try {
      if (rollbackSql.trim()) {
        await client.query(rollbackSql);
      }
      await client.query('DELETE FROM schema_migrations WHERE migration_name = $1', [lastMigration]);
      await client.query('COMMIT');
      console.log(`✓ Successfully rolled back ${lastMigration}.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✗ Failed to roll back ${lastMigration}:`, err.message);
      throw err;
    }

  } catch (err) {
    console.error('Rollback runner failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  rollbackMigration();
}

module.exports = rollbackMigration;
