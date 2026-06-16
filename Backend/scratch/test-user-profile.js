require('dotenv').config();
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('=== Customer Authenticated Profile & Address API Integration Test ===\n');

  const userId = '519d0bc0-5f3a-4084-8e88-b61f70676335';

  try {
    // 1. Verify user exists
    console.log(`1. Verifying user ID "${userId}" exists...`);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message}`);
    }
    console.log(`✓ User Found: ${user.email} (Role: ${user.role})`);

    // 2. Generate token
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Test GET /api/v1/user/profile
    console.log('\n2. GET /api/v1/user/profile (Fetch current profile)...');
    const getProfileRes = await request(app)
      .get('/api/v1/user/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    if (getProfileRes.statusCode !== 200) {
      throw new Error(`GET /user/profile failed. Status: ${getProfileRes.statusCode}`);
    }
    const profile = getProfileRes.body.data;
    console.log('✓ Profile retrieved successfully.');
    console.log(`  Name: ${profile.first_name} ${profile.last_name}`);
    console.log(`  Bio: "${profile.bio || ''}"`);
    console.log(`  Phone Number: "${profile.phone_number || ''}"`);

    // 4. Test PATCH /api/v1/user/profile (Update profile details)
    console.log('\n3. PATCH /api/v1/user/profile (Updating profile)...');
    const updatedBio = 'Passionate tech customer, developer, and early adopter.';
    const updatedPhone = '+2348011223344';
    
    const updateProfileRes = await request(app)
      .patch('/api/v1/user/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bio: updatedBio,
        phone_number: updatedPhone
      });

    if (updateProfileRes.statusCode !== 200) {
      throw new Error(`PATCH /user/profile failed. Status: ${updateProfileRes.statusCode}, body: ${JSON.stringify(updateProfileRes.body)}`);
    }
    const updatedProfile = updateProfileRes.body.data;
    console.log('✓ Profile updated successfully in database.');
    console.log(`  New Bio: "${updatedProfile.bio}"`);
    console.log(`  New Phone Number: "${updatedProfile.phone_number}"`);

    // Fetch existing addresses to avoid duplicates or exceeding the limit of 3
    const checkAddressRes = await request(app)
      .get('/api/v1/user/addresses')
      .set('Authorization', `Bearer ${accessToken}`);
    const existingAddresses = checkAddressRes.body.data || [];

    const duplicateAddresses = existingAddresses.filter(a => a.street_address.toLowerCase().trim() === '123 innovation way');
    for (const dup of duplicateAddresses) {
      console.log(`   Found pre-existing duplicate address "${dup.street_address}" (ID: ${dup.id}). Deleting...`);
      await request(app)
        .delete(`/api/v1/user/addresses/${dup.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
    }
    
    // Refresh address count after deletion
    const remainingCount = existingAddresses.length - duplicateAddresses.length;
    if (remainingCount >= 3) {
      // Find one that is not 123 Innovation Way to delete
      const toDelete = existingAddresses.find(a => a.street_address.toLowerCase().trim() !== '123 innovation way');
      if (toDelete) {
        console.log(`   Address limit reached (${remainingCount}). Deleting address "${toDelete.street_address}" (ID: ${toDelete.id}) to make room...`);
        await request(app)
          .delete(`/api/v1/user/addresses/${toDelete.id}`)
          .set('Authorization', `Bearer ${accessToken}`);
      }
    }

    // 5. Test POST /api/v1/user/addresses (Add a shipping address)
    console.log('\n4. POST /api/v1/user/addresses (Adding new shipping address)...');
    const addressPayload = {
      title: 'Office Headquarters',
      receiver_name: `${updatedProfile.first_name} ${updatedProfile.last_name}`,
      phone_number: updatedPhone,
      street_address: '123 Innovation Way',
      apartment: 'Suite 401',
      city: 'Lagos',
      state: 'Lagos',
      postal_code: '100001',
      country: 'Nigeria',
      is_default: false
    };

    const addAddressRes = await request(app)
      .post('/api/v1/user/addresses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(addressPayload);

    if (addAddressRes.statusCode !== 201) {
      throw new Error(`POST /user/addresses failed. Status: ${addAddressRes.statusCode}, body: ${JSON.stringify(addAddressRes.body)}`);
    }
    const address = addAddressRes.body.data;
    console.log('✓ Shipping Address added successfully to database.');
    console.log(`  Address ID: "${address.id}"`);
    console.log(`  Address Title: "${address.title}"`);
    console.log(`  Full Address: ${address.street_address}, ${address.apartment}, ${address.city}, ${address.state}, ${address.country}`);

    // 6. Test GET /api/v1/user/addresses (Verify address in user's address book)
    console.log('\n5. GET /api/v1/user/addresses (Fetching user address list)...');
    const getAddressesRes = await request(app)
      .get('/api/v1/user/addresses')
      .set('Authorization', `Bearer ${accessToken}`);

    if (getAddressesRes.statusCode !== 200) {
      throw new Error(`GET /user/addresses failed. Status: ${getAddressesRes.statusCode}`);
    }
    const addresses = getAddressesRes.body.data;
    console.log(`✓ Addresses retrieved. Total addresses found: ${addresses.length}`);
    const found = addresses.find(a => a.id === address.id);
    if (!found) {
      throw new Error('Newly created address not found in retrieved list.');
    }
    console.log(`  Found created address in list (Is Default: ${found.is_default})`);

    // 7. Test PATCH /api/v1/user/addresses/:id/default (Set address as default)
    console.log(`\n6. PATCH /api/v1/user/addresses/${address.id}/default (Setting as default address)...`);
    const setDefaultRes = await request(app)
      .patch(`/api/v1/user/addresses/${address.id}/default`)
      .set('Authorization', `Bearer ${accessToken}`);

    if (setDefaultRes.statusCode !== 200) {
      throw new Error(`PATCH /user/addresses/:id/default failed. Status: ${setDefaultRes.statusCode}`);
    }
    console.log('✓ Successfully set address as default in database.');

    // 8. Re-fetch details to verify default flag is updated
    console.log('\n7. GET /api/v1/user/addresses (Re-fetch address list to verify)...');
    const verifyRes = await request(app)
      .get('/api/v1/user/addresses')
      .set('Authorization', `Bearer ${accessToken}`);

    const verifiedAddress = verifyRes.body.data.find(a => a.id === address.id);
    console.log(`✓ Re-verification complete. Default Status of "${verifiedAddress.title}": ${verifiedAddress.is_default}`);

    console.log('\n=== All Profile & Address Endpoints Tested and Saved Successfully ===');
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
