const dns = require('dns').promises;

async function check(host) {
  try {
    const ip = await dns.lookup(host);
    console.log(`DNS lookup for ${host}:`, ip);
  } catch (err) {
    console.error(`DNS lookup failed for ${host}:`, err.message);
  }
}

async function main() {
  await check('aws-0-eu-west-1.pooler.supabase.com');
  await check('sonmxdoomrcxbpkqghdn.supabase.co');
}

main();
