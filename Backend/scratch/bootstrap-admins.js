require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const pgPool = require('../src/config/db');

const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('Connecting to database...');
  const client = await pgPool.connect();
  try {
    const passwordHash = await bcrypt.hash('SuperAdmin123!', BCRYPT_ROUNDS);

    const emails = ['admin@novastore.com', 'apitestadmin@novatest.dev'];
    for (const email of emails) {
      console.log(`Setting password and role for ${email}...`);
      
      const userRes = await client.query(
        `UPDATE users 
         SET password_hash = $1, role = 'SUPER_ADMIN', is_active = true, is_email_verified = true
         WHERE email = $2
         RETURNING id;`,
        [passwordHash, email]
      );

      if (userRes.rows.length === 0) {
        console.log(`User ${email} does not exist. Skipping.`);
        continue;
      }

      const userId = userRes.rows[0].id;
      console.log(`User ${email} updated (ID: ${userId}). Ensuring user_roles entry...`);

      const roleCheck = await client.query(
        `SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2;`,
        [userId, SUPER_ADMIN_ROLE_ID]
      );

      if (roleCheck.rows.length === 0) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`,
          [userId, SUPER_ADMIN_ROLE_ID]
        );
        console.log(`Assigned SUPER_ADMIN role to ${email}.`);
      } else {
        console.log(`${email} already has SUPER_ADMIN role assigned.`);
      }
    }

    console.log('✅ Bootstrap completed successfully.');
  } catch (err) {
    console.error('Error during bootstrap:', err);
  } finally {
    client.release();
    await pgPool.end();
  }
}

main();
