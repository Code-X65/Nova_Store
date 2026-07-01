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
    console.log('Copying role permissions to uppercase ADMIN...');
    
    // Copy permissions from 'admin' (lowercase) to 'ADMIN' (uppercase)
    const result = await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT 'ce698686-62a3-4f65-8ce0-b4adeb9f30c0', permission_id
      FROM role_permissions
      WHERE role_id = 'dda4c7ee-a09d-4a71-9a52-8f2b8e60da94'
      ON CONFLICT DO NOTHING;
    `);
    
    console.log(`Successfully copied ${result.rowCount} permissions to uppercase ADMIN role!`);
  } catch (err) {
    console.error('Error syncing permissions:', err);
  } finally {
    await client.end();
  }
}

main();
