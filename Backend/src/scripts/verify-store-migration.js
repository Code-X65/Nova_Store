/**
 * verify-store-migration.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone DB verification script for migrations 053 + 054.
 * Connects directly to the database (no app server needed) and runs a
 * comprehensive set of assertions to confirm:
 *
 *   1.  stores table structure and data
 *   2.  store_settings table structure and data
 *   3.  store_id presence on all scoped tables
 *   4.  store_id NOT NULL enforcement on core tables
 *   5.  Foreign key integrity
 *   6.  All expected indexes exist
 *   7.  No orphaned rows (NULL store_id where it should be set)
 *
 * Usage:
 *   node src/scripts/verify-store-migration.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('pg');
require('dotenv').config();

// ── helpers ──────────────────────────────────────────────────────────────────

const PASS  = '  ✅ PASS';
const FAIL  = '  ❌ FAIL';
const WARN  = '  ⚠️  WARN';
const INFO  = '  ℹ️  INFO';

let passCount = 0;
let failCount = 0;
let warnCount = 0;

function pass(msg) { console.log(`${PASS}: ${msg}`); passCount++; }
function fail(msg) { console.error(`${FAIL}: ${msg}`); failCount++; }
function warn(msg) { console.warn(`${WARN}: ${msg}`); warnCount++; }
function info(msg) { console.log(`${INFO}: ${msg}`); }
function heading(msg) { console.log(`\n── ${msg} ${'─'.repeat(60 - msg.length)}`); }

// ── check helpers ─────────────────────────────────────────────────────────────

async function tableExists(client, tableName) {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT FROM pg_tables
       WHERE schemaname = 'public' AND tablename = $1
     )`,
    [tableName]
  );
  return r.rows[0].exists;
}

async function columnExists(client, tableName, columnName) {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name  = $1
         AND column_name = $2
     )`,
    [tableName, columnName]
  );
  return r.rows[0].exists;
}

async function columnIsNotNull(client, tableName, columnName) {
  const r = await client.query(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = $1
       AND column_name  = $2`,
    [tableName, columnName]
  );
  if (r.rows.length === 0) return null; // column missing
  return r.rows[0].is_nullable === 'NO';
}

async function indexExists(client, indexName) {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = $1
     )`,
    [indexName]
  );
  return r.rows[0].exists;
}

async function countNull(client, tableName, columnName) {
  const r = await client.query(
    `SELECT COUNT(*) FROM ${tableName} WHERE ${columnName} IS NULL`
  );
  return parseInt(r.rows[0].count, 10);
}

async function count(client, tableName, where = '') {
  const r = await client.query(
    `SELECT COUNT(*) FROM ${tableName} ${where}`
  );
  return parseInt(r.rows[0].count, 10);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function verifyStoreMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('\n🔍 Nova Store — Store Migration Verification');
    console.log('='.repeat(65));

    // ─────────────────────────────────────────────────────────────────────────
    heading('1. stores table — structure');
    // ─────────────────────────────────────────────────────────────────────────

    if (await tableExists(client, 'stores')) {
      pass('stores table exists');
    } else {
      fail('stores table MISSING — run migration 053'); return;
    }

    const storeColumns = [
      'id', 'name', 'slug', 'tagline', 'description',
      'email', 'phone', 'whatsapp', 'website_url',
      'address', 'logo_url', 'banner_url', 'favicon_url',
      'primary_color', 'secondary_color', 'social_links',
      'business_registration_number', 'tax_id', 'business_type',
      'business_hours', 'timezone', 'currency', 'country', 'language',
      'is_active', 'is_maintenance_mode', 'accepts_guest_orders',
      'return_window_days', 'return_policy_text',
      'created_by', 'created_at', 'updated_at',
    ];

    for (const col of storeColumns) {
      if (await columnExists(client, 'stores', col)) {
        pass(`stores.${col} exists`);
      } else {
        fail(`stores.${col} is MISSING`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    heading('2. store_settings table — structure');
    // ─────────────────────────────────────────────────────────────────────────

    if (await tableExists(client, 'store_settings')) {
      pass('store_settings table exists');
    } else {
      fail('store_settings table MISSING — run migration 053');
    }

    // ─────────────────────────────────────────────────────────────────────────
    heading('3. Default store data');
    // ─────────────────────────────────────────────────────────────────────────

    const storeCount = await count(client, 'stores');
    if (storeCount >= 1) {
      pass(`stores has ${storeCount} row(s)`);
    } else {
      fail('stores table is empty — backfill in 054 may have failed');
    }

    const defaultStore = await client.query(
      `SELECT id, name, slug, email, currency, timezone, created_by
       FROM stores WHERE slug = 'nova-store' LIMIT 1`
    );

    if (defaultStore.rows.length === 1) {
      const s = defaultStore.rows[0];
      pass(`Default store found: "${s.name}" (slug: ${s.slug})`);
      info(`  Store ID   : ${s.id}`);
      info(`  Currency   : ${s.currency}`);
      info(`  Timezone   : ${s.timezone}`);
      info(`  Created by : ${s.created_by}`);
    } else {
      fail('Default "nova-store" row not found in stores table');
    }

    const settingsCount = await count(client, 'store_settings');
    if (settingsCount >= 7) {
      pass(`store_settings has ${settingsCount} row(s) (≥7 expected seeds)`);
    } else {
      warn(`store_settings has only ${settingsCount} row(s) — expected at least 7`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    heading('4. store_id columns — presence on all scoped tables');
    // ─────────────────────────────────────────────────────────────────────────

    const scopedTables = [
      'users',
      'products',
      'product_categories',
      'product_brands',
      'orders',
      'carts',
      'wishlists',
      'coupons',
      'inventory_transactions',
      'inventory_reservations',
      'invitations',
    ];

    for (const table of scopedTables) {
      if (await columnExists(client, table, 'store_id')) {
        pass(`${table}.store_id column exists`);
      } else {
        fail(`${table}.store_id column MISSING — run migration 054`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    heading('5. NOT NULL enforcement on core catalog tables');
    // ─────────────────────────────────────────────────────────────────────────

    const notNullTables = ['products', 'product_categories', 'product_brands', 'coupons'];

    for (const table of notNullTables) {
      const isNotNull = await columnIsNotNull(client, table, 'store_id');
      if (isNotNull === true) {
        pass(`${table}.store_id is NOT NULL`);
      } else if (isNotNull === false) {
        fail(`${table}.store_id is still nullable — NOT NULL constraint not applied`);
      } else {
        fail(`${table}.store_id column missing — cannot check NOT NULL`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    heading('6. NULL store_id backfill check (no orphaned rows)');
    // ─────────────────────────────────────────────────────────────────────────

    // Tables where every existing row should have been backfilled
    const backfillTables = [
      'products',
      'product_categories',
      'product_brands',
      'orders',
      'coupons',
    ];

    for (const table of backfillTables) {
      const nullCount = await countNull(client, table, 'store_id');
      if (nullCount === 0) {
        const total = await count(client, table);
        pass(`${table}: all ${total} row(s) have store_id set`);
      } else {
        fail(`${table}: ${nullCount} row(s) have NULL store_id — backfill incomplete`);
      }
    }

    // users: only admins/staff should be backfilled — customers stay NULL
    const adminNullCount = await client.query(
      `SELECT COUNT(*) FROM users WHERE role IN ('ADMIN','SUPER_ADMIN','MODERATOR') AND store_id IS NULL`
    );
    const adminNulls = parseInt(adminNullCount.rows[0].count, 10);
    if (adminNulls === 0) {
      pass('users: all ADMIN/SUPER_ADMIN/MODERATOR users have store_id set');
    } else {
      fail(`users: ${adminNulls} admin/staff user(s) have NULL store_id`);
    }

    // Report customer nulls as info (expected)
    const customerNulls = await countNull(client, 'users', 'store_id');
    info(`users: ${customerNulls} customer(s) have NULL store_id (expected — global customers)`);

    // ─────────────────────────────────────────────────────────────────────────
    heading('7. Indexes');
    // ─────────────────────────────────────────────────────────────────────────

    const expectedIndexes = [
      'idx_stores_slug',
      'idx_stores_active',
      'idx_stores_created_by',
      'idx_store_settings_store_id',
      'idx_store_settings_key',
      'idx_users_store_id',
      'idx_products_store_id',
      'idx_products_store_status',
      'idx_product_categories_store_id',
      'idx_product_brands_store_id',
      'idx_orders_store_id',
      'idx_orders_store_status',
      'idx_carts_store_id',
      'idx_wishlists_store_id',
      'idx_coupons_store_id',
      'idx_inventory_transactions_store_id',
      'idx_inventory_reservations_store_id',
      'idx_invitations_store_id',
    ];

    for (const idx of expectedIndexes) {
      if (await indexExists(client, idx)) {
        pass(`Index ${idx} exists`);
      } else {
        fail(`Index ${idx} MISSING`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    heading('8. Foreign key integrity (spot check)');
    // ─────────────────────────────────────────────────────────────────────────

    // Products referencing a non-existent store
    const orphanProducts = await client.query(
      `SELECT COUNT(*) FROM products p
       LEFT JOIN stores s ON p.store_id = s.id
       WHERE p.store_id IS NOT NULL AND s.id IS NULL`
    );
    const orphan = parseInt(orphanProducts.rows[0].count, 10);
    if (orphan === 0) {
      pass('No products reference a non-existent store (FK integrity OK)');
    } else {
      fail(`${orphan} product(s) reference a non-existent store — FK violation!`);
    }

    // Orders referencing a non-existent store
    const orphanOrders = await client.query(
      `SELECT COUNT(*) FROM orders o
       LEFT JOIN stores s ON o.store_id = s.id
       WHERE o.store_id IS NOT NULL AND s.id IS NULL`
    );
    const orphanO = parseInt(orphanOrders.rows[0].count, 10);
    if (orphanO === 0) {
      pass('No orders reference a non-existent store (FK integrity OK)');
    } else {
      fail(`${orphanO} order(s) reference a non-existent store — FK violation!`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Final summary
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(65));
    console.log(`\n📊 Results: ${passCount} passed  |  ${warnCount} warnings  |  ${failCount} failed\n`);

    if (failCount === 0) {
      console.log('🎉 Store migration verification PASSED! Phase 1 is complete.\n');
      process.exit(0);
    } else {
      console.error(`❌ Store migration verification FAILED with ${failCount} error(s).\n`);
      process.exit(1);
    }

  } catch (err) {
    console.error('\n❌ Verification script crashed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyStoreMigration();
