require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pgPool = require('../src/config/db');

async function run() {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    
    const adminEmail = 'admin@novastore.com';
    const storeAdminEmail = 'store_admin@novastore.com';
    
    // Get user IDs
    const { rows: adminRows } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    const { rows: storeAdminRows } = await client.query('SELECT id FROM users WHERE email = $1', [storeAdminEmail]);
    
    if (adminRows.length === 0) {
      console.log(`User ${adminEmail} not found. Nothing to transfer.`);
      await client.query('COMMIT');
      return;
    }
    
    if (storeAdminRows.length === 0) {
      console.log(`User ${storeAdminEmail} not found. Cannot proceed.`);
      await client.query('ROLLBACK');
      return;
    }
    
    const adminId = adminRows[0].id;
    const storeAdminId = storeAdminRows[0].id;
    
    console.log(`Transferring data from ${adminId} (${adminEmail}) to ${storeAdminId} (${storeAdminEmail})...`);
    
    // Update store admin role to STORE_OWNER in users table
    await client.query('UPDATE users SET role = \'STORE_OWNER\' WHERE id = $1', [storeAdminId]);
    
    // Update stores created_by
    await client.query('UPDATE stores SET created_by = $1 WHERE created_by = $2', [storeAdminId, adminId]);
    
    // Update invitations invited_by
    await client.query('UPDATE invitations SET invited_by = $1 WHERE invited_by = $2', [storeAdminId, adminId]);
    
    // Update user_roles granted_by
    await client.query('UPDATE user_roles SET granted_by = $1 WHERE granted_by = $2', [storeAdminId, adminId]);
    
    // Update audit_logs user_id
    await client.query('UPDATE audit_logs SET user_id = $1 WHERE user_id = $2', [storeAdminId, adminId]);
    
    // Delete user roles for admin
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [adminId]);
    
    // Delete admin user from users table
    await client.query('DELETE FROM users WHERE id = $1', [adminId]);
    
    console.log('Successfully transferred all records and deleted admin@novastore.com.');
    await client.query('COMMIT');
  } catch(err) {
    console.error('Migration failed:', err);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    pgPool.end();
  }
}
run();
