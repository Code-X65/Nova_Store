require('dotenv').config(); 
const {Client} = require('pg'); 
const client = new Client({connectionString: process.env.DATABASE_URL, ssl: {rejectUnauthorized: false}}); 
client.connect().then(async () => { 
  try { 
    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'MANAGER'"); 
    const roleId = roleRes.rows[0].id; 
    await client.query("INSERT INTO role_permissions (role_id, permission_id) SELECT $1, id FROM permissions WHERE key IN ('user:read', 'user:write') ON CONFLICT DO NOTHING", [roleId]); 
    console.log('user:read and user:write added to MANAGER'); 
  } catch(e) { 
    console.error(e); 
  } finally { 
    client.end(); 
  } 
});
