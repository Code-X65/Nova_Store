const { Client } = require('pg');
require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function createStoreOwner() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    
    const storeId = 'aa49aa57-6129-4c48-bbab-9e95646b8381';
    const email = 'store_admin@novastore.com';
    const plainPassword = 'N0vaStore@Admin2026!';
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await client.query('UPDATE users SET password_hash = $1, store_id = $2 WHERE id = $3', [passwordHash, storeId, userId]);
      console.log('Updated existing user password.');
    } else {
      userId = crypto.randomUUID();
      await client.query(`
        INSERT INTO users (id, email, password_hash, first_name, last_name, is_email_verified, is_active, store_id, referral_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [userId, email, passwordHash, 'Store', 'Admin', true, true, storeId, 'STORE_OWNER']);
      console.log('Created new user.');
    }
    
    const roleRes = await client.query('SELECT id FROM roles WHERE name = $1', ['STORE_OWNER']);
    if (roleRes.rows.length > 0) {
      const roleId = roleRes.rows[0].id;
      
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, roleId]);
      console.log('Assigned STORE_OWNER role.');
    } else {
      console.log('Warning: STORE_OWNER role not found.');
    }
    
    console.log('Email:', email);
    console.log('Password:', plainPassword);
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

createStoreOwner();
