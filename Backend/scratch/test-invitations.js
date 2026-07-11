require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const invitationModel = require('../src/models/invitation.model');

async function testList() {
  try {
    const list = await invitationModel.list({ status: 'pending' });
    console.log('List Success:', list);
  } catch (err) {
    console.error('List Error:', err);
  }
}

testList();
