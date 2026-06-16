require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  const rpcsToCheck = [
    'create_order_with_items',
    'reserve_stock_increment',
    'release_stock_reservation',
    'commit_reserved_stock',
    'release_session_reservations',
    'increment_coupon_usage',
    'is_coupon_valid_for_user',
    'get_products_by_attributes',
    'get_sales_summary',
    'get_best_sellers',
    'get_user_growth'
  ];

  console.log('=== Checking live Database RPC Functions ===');
  
  for (const rpc of rpcsToCheck) {
    const query = `
      SELECT proname, prosrc 
      FROM pg_proc 
      JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
      WHERE pg_namespace.nspname = 'public' AND pg_proc.proname = $1;
    `;
    const res = await client.query(query, [rpc]);
    if (res.rows.length > 0) {
      console.log(`✓ [FOUND] ${rpc} exists in database.`);
    } else {
      console.log(`❌ [MISSING] ${rpc} is NOT defined in database.`);
    }
  }

  await client.end();
}

run().catch(console.error);
