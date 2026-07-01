require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pgPool = require('../src/config/db');

async function main() {
  console.log('Connecting to database...');
  const client = await pgPool.connect();
  try {
    console.log('Querying users...');
    const usersRes = await client.query('SELECT id, email, first_name, last_name, role, is_active FROM users LIMIT 20;');
    console.log('Users list:');
    console.table(usersRes.rows);

    console.log('Querying roles...');
    const rolesRes = await client.query('SELECT * FROM roles;');
    console.table(rolesRes.rows);

    console.log('Querying user_roles...');
    const userRolesRes = await client.query(`
      SELECT ur.user_id, u.email, r.name as role_name
      FROM user_roles ur
      JOIN users u ON ur.user_id = u.id
      JOIN roles r ON ur.role_id = r.id;
    `);
    console.table(userRolesRes.rows);
  } catch (err) {
    console.error('Error during database query:', err);
  } finally {
    client.release();
    await pgPool.end();
  }
}

main();
