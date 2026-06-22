const dotenv = require('dotenv');
dotenv.config();

const { Client } = require('pg');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const { createClient: createRedisClient } = require('redis');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

async function runPreFlightCheck() {
  console.log('🔍 Starting Nova Store Production Pre-Flight Validation...\n');
  let overallPassed = true;

  // 1. Validate Environment Variables via Joi
  console.log('1. [Config] Validating environment schema...');
  try {
    const envVars = require('../config/env');
    console.log('   ✓ PASS: Environment variables schema is valid.');
  } catch (err) {
    console.error('   ✗ FAIL: Environment variables validation failed:', err.message);
    overallPassed = false;
  }

  // 2. Test PostgreSQL & Migration Status
  console.log('\n2. [Database] Connecting and verifying migrations...');
  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) {
    console.error('   ✗ FAIL: DATABASE_URL is not set.');
    overallPassed = false;
  } else {
    const client = new Client({
      connectionString: pgUrl,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log('   ✓ Connected to PostgreSQL database.');

      // Check applied migrations count
      const migRes = await client.query("SELECT COUNT(*) FROM schema_migrations");
      const count = parseInt(migRes.rows[0].count, 10);
      console.log(`   ✓ Found ${count} applied migrations.`);
      if (count < 55) {
        console.error(`   ✗ FAIL: Only ${count}/55 migrations are applied. Run 'npm run db:migrate' to update schema.`);
        overallPassed = false;
      } else {
        console.log('   ✓ PASS: All migrations up to 048 are applied.');
      }

      // Check core roles
      const rolesCheck = await client.query("SELECT COUNT(*) FROM roles WHERE name IN ('customer', 'admin', 'SUPER_ADMIN')");
      const rolesCount = parseInt(rolesCheck.rows[0].count, 10);
      if (rolesCount < 3) {
        console.warn(`   ⚠️ WARNING: Core roles are incomplete in the database. (Count: ${rolesCount}/3)`);
      } else {
        console.log('   ✓ PASS: Core system roles verified.');
      }

      // Check Paystack Key in database
      const settingsCheck = await client.query("SELECT value FROM settings WHERE key = 'paystack_secret_key'");
      if (settingsCheck.rows.length > 0 && settingsCheck.rows[0].value) {
        console.log('   ✓ PASS: Paystack secret key is configured in settings table.');
      } else if (process.env.PAYSTACK_SECRET_KEY) {
        console.log('   ✓ PASS: Paystack secret key is configured in process environment.');
      } else {
        console.warn('   ⚠️ WARNING: Paystack secret key is not set in environment or settings table.');
      }

      await client.end();
    } catch (err) {
      console.error('   ✗ FAIL: PostgreSQL connection failed:', err.message);
      overallPassed = false;
    }
  }

  // 3. Test Redis Connectivity
  console.log('\n3. [Cache] Verifying Redis connectivity...');
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('   ✗ FAIL: REDIS_URL is not set.');
    overallPassed = false;
  } else {
    const redisClient = createRedisClient({ url: redisUrl });
    redisClient.on('error', () => {}); // Suppress log pollution
    try {
      await redisClient.connect();
      const pingRes = await redisClient.ping();
      if (pingRes === 'PONG') {
        console.log('   ✓ PASS: Redis connection active and PING/PONG succeeded.');
      } else {
        console.error('   ✗ FAIL: Redis responded with:', pingRes);
        overallPassed = false;
      }
      await redisClient.disconnect();
    } catch (err) {
      console.error('   ✗ FAIL: Redis connection failed:', err.message);
      overallPassed = false;
    }
  }

  // 4. Test Supabase Storage Buckets
  console.log('\n4. [Storage] Checking Supabase storage buckets...');
  const sbUrl = process.env.SUPABASE_URL;
  const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbServiceKey) {
    console.error('   ✗ FAIL: Supabase URL or Service Role Key missing.');
    overallPassed = false;
  } else {
    const supabase = createSupabaseClient(sbUrl, sbServiceKey);
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
        console.error('   ✗ FAIL: Supabase storage list failed:', error.message);
        overallPassed = false;
      } else {
        const bucketNames = buckets.map(b => b.name);
        const requiredBuckets = ['return-evidence', 'uploads'];
        let bucketsOk = true;
        requiredBuckets.forEach(b => {
          if (bucketNames.includes(b)) {
            console.log(`   ✓ Bucket '${b}' exists.`);
          } else {
            console.error(`   ✗ FAIL: Bucket '${b}' is missing.`);
            bucketsOk = false;
          }
        });
        if (bucketsOk) {
          console.log('   ✓ PASS: All required storage buckets are present.');
        } else {
          overallPassed = false;
        }
      }
    } catch (err) {
      console.error('   ✗ FAIL: Supabase client request failed:', err.message);
      overallPassed = false;
    }
  }

  // 5. Test SMTP Outbound Mailer
  console.log('\n5. [Email] Verifying SMTP relay handshake...');
  const mailHost = process.env.SMTP_HOST;
  const mailPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const mailUser = process.env.SMTP_USER;
  const mailPass = process.env.SMTP_PASS;
  if (!mailHost || !mailUser || !mailPass) {
    console.error('   ✗ FAIL: SMTP credentials are not fully configured.');
    overallPassed = false;
  } else {
    const transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailPort === 465,
      auth: { user: mailUser, pass: mailPass }
    });
    try {
      await transporter.verify();
      console.log('   ✓ PASS: SMTP credentials handshake successful.');
    } catch (err) {
      console.error('   ✗ FAIL: SMTP verification handshake failed:', err.message);
      overallPassed = false;
    }
  }

  // 6. Test Twilio SMS Integration
  console.log('\n6. [SMS] Verifying Twilio credentials...');
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  if (!twilioSid || !twilioToken) {
    console.warn('   ⚠️ WARNING: Twilio credentials not set. Application will fall back to local stub logger.');
  } else {
    const client = twilio(twilioSid, twilioToken);
    try {
      const account = await client.api.accounts(twilioSid).fetch();
      console.log(`   ✓ PASS: Twilio account verified (Account friendlyName: "${account.friendlyName}", status: "${account.status}").`);
    } catch (err) {
      console.error('   ✗ FAIL: Twilio credentials verification failed:', err.message);
      overallPassed = false;
    }
  }

  // Final Summary
  console.log('\n==================================================');
  if (overallPassed) {
    console.log('✅ PRE-FLIGHT VERIFICATION SUCCESSFUL: App is ready for production deployment!');
    process.exit(0);
  } else {
    console.error('❌ PRE-FLIGHT VERIFICATION FAILED: Resolve critical issues before launching.');
    process.exit(1);
  }
}

runPreFlightCheck();
