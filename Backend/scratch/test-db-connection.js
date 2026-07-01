const { Client } = require('pg');

const conn1 = 'postgresql://postgres.sonmxdoomrcxbpkqghdn:%24Newpassword%40100@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const conn2 = 'postgresql://postgres.sonmxdoomrcxbpkqghdn:%24Newpassword%40100@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';

async function testConnection(url, name) {
  console.log(`Testing connection for ${name}...`);
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000
  });
  try {
    await client.connect();
    console.log(`✅ Success for ${name}!`);
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(`❌ Failed for ${name}:`, err.message);
    return false;
  }
}

async function main() {
  const success1 = await testConnection(conn1, 'Pooler Port 6543');
  const success2 = await testConnection(conn2, 'Direct Port 5432');
}

main();
