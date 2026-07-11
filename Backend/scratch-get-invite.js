require('dotenv').config();
const { Client } = require('pg');

async function getLatestInviteToken() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    const result = await client.query('SELECT email, token FROM invitations ORDER BY created_at DESC LIMIT 1');
    if (result.rows.length > 0) {
      console.log(`\n✅ Latest invitation for ${result.rows[0].email}:`);
      console.log(`🔗 http://localhost:3000/accept-invite/${result.rows[0].token}\n`);
    } else {
      console.log('No invitations found in the database.');
    }
  } catch (err) {
    console.error('Error fetching invite:', err);
  } finally {
    await client.end();
  }
}

getLatestInviteToken();
