require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT id, email, role FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN') LIMIT 5")
  .then(r => {
    console.log('Existing admins:', JSON.stringify(r.rows, null, 2));
    return pool.end();
  })
  .catch(e => {
    console.error('DB error:', e.message);
    return pool.end();
  });
