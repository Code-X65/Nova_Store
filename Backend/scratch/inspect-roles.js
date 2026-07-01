require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL.replace(':6543/', ':5432/').replace('pgbouncer=true', ''),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  await client.connect();
  try {
    const roles = await client.query('SELECT * FROM roles');
    console.table(roles.rows);
  } catch (err) {
    console.error('Error querying roles:', err);
  } finally {
    await client.end();
  }
}

main();
