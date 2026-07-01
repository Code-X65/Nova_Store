require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  await client.connect();
  try {
    console.log('Querying role_permissions...');
    const rolePermissions = await client.query(`
      SELECT r.name as role_name, p.key as permission_key
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id;
    `);
    console.table(rolePermissions.rows);
  } catch (err) {
    console.error('Error querying permissions:', err);
  } finally {
    await client.end();
  }
}

main();
