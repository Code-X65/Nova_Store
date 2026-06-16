require('dotenv').config();
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('=== Testing Address Book 3-Limit and Duplicate Constraint ===\n');

  const userId = '519d0bc0-5f3a-4084-8e88-b61f70676335';

  try {
    // 1. Fetch user & count existing addresses
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET);

    console.log(`1. Fetching current address list for ${user.email}...`);
    const initialListRes = await request(app)
      .get('/api/v1/user/addresses')
      .set('Authorization', `Bearer ${accessToken}`);

    const initialAddresses = initialListRes.body.data;
    console.log(`   Current count: ${initialAddresses.length}`);

    // 2. Try adding a duplicate of the first address (if any exists)
    if (initialAddresses.length > 0) {
      const first = initialAddresses[0];
      console.log(`\n2. Attempting to add a duplicate of "${first.title}"...`);
      const dupRes = await request(app)
        .post('/api/v1/user/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Duplicate Title',
          receiver_name: first.receiver_name,
          phone_number: first.phone_number,
          street_address: first.street_address,
          apartment: first.apartment,
          city: first.city,
          state: first.state,
          postal_code: first.postal_code,
          country: first.country
        });

      console.log(`   Status Code: ${dupRes.statusCode}`);
      console.log(`   Response Message: "${dupRes.body.error?.message || dupRes.body.message}"`);
      if (dupRes.statusCode === 400 && dupRes.body.error?.message.includes('already exists')) {
        console.log('✓ Successfully blocked duplicate address entry.');
      } else {
        throw new Error('Test failed: Duplicate address was not blocked.');
      }
    }

    // 3. Fill up to 3 addresses
    let currentCount = initialAddresses.length;
    while (currentCount < 3) {
      currentCount++;
      console.log(`\n3. Filling address book: Adding address #${currentCount}...`);
      const addRes = await request(app)
        .post('/api/v1/user/addresses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: `Address Slot #${currentCount}`,
          receiver_name: 'John Doe',
          phone_number: '+2348000000000',
          street_address: `${currentCount * 100} Innovation Way`,
          city: 'Lagos',
          state: 'Lagos',
          postal_code: '100001',
          country: 'Nigeria'
        });

      if (addRes.statusCode !== 201) {
        throw new Error(`Failed to fill address book. Status: ${addRes.statusCode}`);
      }
      console.log(`✓ Address #${currentCount} created successfully.`);
    }

    // 4. Try adding a 4th address (should fail limit)
    console.log('\n4. Attempting to add a 4th address (exceeding limit of 3)...');
    const exceedRes = await request(app)
      .post('/api/v1/user/addresses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Exceeding Address',
        receiver_name: 'John Doe',
        phone_number: '+2348000000000',
        street_address: '999 Forbidden Road',
        city: 'Lagos',
        state: 'Lagos',
        postal_code: '100001',
        country: 'Nigeria'
      });

    console.log(`   Status Code: ${exceedRes.statusCode}`);
    console.log(`   Response Message: "${exceedRes.body.error?.message || exceedRes.body.message}"`);
    if (exceedRes.statusCode === 400 && exceedRes.body.error?.message.includes('limit reached')) {
      console.log('✓ Successfully blocked exceeding address limit (4th address block).');
    } else {
      throw new Error('Test failed: Exceeding 3 addresses limit was not blocked.');
    }

    console.log('\n=== Address constraint checks completed successfully! ===');
  } catch (error) {
    console.error('\n✗ Test Failed:', error.message);
    process.exit(1);
  }

  // Graceful exit
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

run();
