require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const invitationService = require('../src/services/invitation.service');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const { data: user } = await supabase.from('users').select('id').limit(1).single();
    const { data: role } = await supabase.from('roles').select('id').limit(1).single();

    if (!user || !role) {
      console.log('No user or role to test with');
      return;
    }

    const res = await invitationService.createInvitation({
      email: 'test@example.com',
      roleId: role.id,
      invitedBy: user.id,
      req: { get: () => 'localhost:3000', protocol: 'http', admin: { id: user.id, roles: ['STORE_OWNER'] } }
    });
    console.log('Success', res);
  } catch (err) {
    console.error('Error', err);
  }
}
run();
