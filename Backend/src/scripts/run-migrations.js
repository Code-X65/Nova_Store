const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const rollbackMigration = require('./rollback-migration');

async function checkMigrationState(client, fileName) {
  const tableExists = async (tableName) => {
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = $1
      );
    `, [tableName]);
    return res.rows[0].exists;
  };
  const columnExists = async (tableName, columnName) => {
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
      );
    `, [tableName, columnName]);
    return res.rows[0].exists;
  };

  if (fileName.includes('001_create_users_table')) return await tableExists('users');
  if (fileName.includes('002_onboarding')) return await tableExists('onboarding_questions');
  if (fileName.includes('004_create_roles_tables')) return await tableExists('roles');
  if (fileName.includes('006_create_products_tables')) return await tableExists('products');
  if (fileName.includes('008_create_categories_brands_tables')) return await tableExists('product_categories');
  if (fileName.includes('009_product_reviews')) return await tableExists('product_reviews');
  if (fileName.includes('010_cart_wishlist')) return await tableExists('carts');
  if (fileName.includes('011_checkout_orders')) return await tableExists('orders');
  if (fileName.includes('012_orders_management')) return await tableExists('order_status_history');
  if (fileName.includes('013_shipping_delivery')) return await tableExists('shipping_zones');
  if (fileName.includes('014_reviews_ratings')) return await tableExists('review_helpfulness');
  if (fileName.includes('015_coupon_enhancements')) return await columnExists('coupons', 'max_discount');
  if (fileName.includes('016_notifications')) return await tableExists('notifications');
  if (fileName.includes('019_settings')) return await tableExists('settings');
  if (fileName.includes('020_audit_logs')) return await tableExists('audit_logs');
  if (fileName.includes('022_orders_refunds_returns')) return await columnExists('orders', 'return_status');
  if (fileName.includes('023_inventory_reservations')) return await tableExists('inventory_reservations');
  if (fileName.includes('028_review_reporting')) return await tableExists('review_reports');
  if (fileName.includes('029_phone_verification_tokens')) return await tableExists('phone_verification_tokens');
  if (fileName.includes('030_admin_auth')) return await tableExists('admins');
  if (fileName.includes('030_registration_fields')) return await columnExists('users', 'home_address');
  if (fileName.includes('031_telemetry_and_recommendations')) return await tableExists('user_search_logs');
  if (fileName.includes('032_category_attributes')) return await tableExists('category_attributes');
  if (fileName.includes('035_add_referrals')) return await columnExists('users', 'referral_code');
  if (fileName.includes('036_add_is_admin_to_sessions')) return await columnExists('admin_sessions', 'is_admin');
  if (fileName.includes('038_add_oauth_providers')) return await columnExists('users', 'google_id');
  if (fileName.includes('043_add_idempotency_keys')) return await tableExists('idempotency_keys');
  if (fileName.includes('044_missing_features_schema')) return await tableExists('tax_rules');
  if (fileName.includes('045_superadmin_rbac_invitations')) return await tableExists('invitations');
  if (fileName.includes('047_manual_delivery_and_returns')) return await tableExists('delivery_dispatches');
  if (fileName.includes('048_auth_logging_and_queue_hardening')) return await columnExists('admin_auth_logs', 'user_agent');

  const prefix = parseInt(fileName.split('_')[0], 10);
  if (!isNaN(prefix) && prefix < 25) {
    return await tableExists('users');
  }
  return false;
}

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment variables.');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ WARNING: Pre-migration database backup is highly recommended before executing migrations on production.');
    console.log('Starting migrations in:');
    for (let i = 5; i > 0; i--) {
      console.log(`  ${i}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
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

    // Check if the 'users' table already exists BEFORE creating schema_migrations
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'users'
      );
    `);
    const usersTableExists = tableCheck.rows[0].exists;

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

    // Query applied migrations count
    const checkCount = await client.query('SELECT COUNT(*) FROM schema_migrations');
    const migrationsCount = parseInt(checkCount.rows[0].count);

    // Intelligent self-healing synchronization: check which tables/columns already exist in the database,
    // and populate schema_migrations accordingly so that only missing migrations are run.
    if (migrationsCount === 0 && usersTableExists) {
      console.log('Pre-existing database tables detected. Synchronizing schema_migrations table intelligently...');
      for (const file of files) {
        const isApplied = await checkMigrationState(client, file);
        if (isApplied) {
          await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
          console.log(`  ✓ Synced: ${file} marked as already applied.`);
        }
      }
      console.log('✓ Successfully synchronized schema_migrations table with existing database state.');
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

    // Seed data verification
    console.log('🔍 Running seed data verification...');
    
    // Verify default roles exist
    const rolesCheck = await client.query("SELECT COUNT(*) FROM roles WHERE name IN ('USER', 'ADMIN', 'SUPER_ADMIN')");
    const rolesCount = parseInt(rolesCheck.rows[0].count, 10);
    if (rolesCount < 3) {
      console.warn('⚠️ WARNING: Core roles (USER, ADMIN, SUPER_ADMIN) are not fully seeded. Count: ' + rolesCount);
    } else {
      console.log('  ✓ Verified: Core roles exist.');
    }

    // Verify core settings exist
    const settingsCheck = await client.query("SELECT COUNT(*) FROM settings");
    const settingsCount = parseInt(settingsCheck.rows[0].count, 10);
    if (settingsCount === 0) {
      console.warn('⚠️ WARNING: Core configuration settings are not seeded in settings table.');
    } else {
      console.log('  ✓ Verified: Core settings exist.');
    }

    // Verify notification templates exist
    const templatesCheck = await client.query("SELECT COUNT(*) FROM notification_templates WHERE key IN ('email_verification', 'email_change_verification')");
    const templatesCount = parseInt(templatesCheck.rows[0].count, 10);
    if (templatesCount < 2) {
      console.warn('⚠️ WARNING: Essential notification templates are missing.');
    } else {
      console.log('  ✓ Verified: Core notification templates exist.');
    }

  } catch (err) {
    console.error('Migration runner failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  if (process.argv.includes('--rollback')) {
    rollbackMigration();
  } else {
    runMigrations();
  }
}

module.exports = runMigrations;
