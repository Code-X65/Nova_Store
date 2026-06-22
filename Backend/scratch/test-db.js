const { Client } = require('pg');
require('dotenv').config();

async function test() {
  console.log('Connecting to:', process.env.DATABASE_URL);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log('SUCCESS connecting to DB!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('ERROR connecting to DB:', err);
  }
}
test();
