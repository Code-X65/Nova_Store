require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`
      DELETE FROM users 
      WHERE role IN ('MANAGER', 'ORDER_STAFF', 'INVENTORY_STAFF', 'ADMIN')
    `);
    console.log('Deleted non-owner staff rows:', res.rowCount);
  } catch (e) {
    console.error(e);
  }
  pool.end();
}

run();
