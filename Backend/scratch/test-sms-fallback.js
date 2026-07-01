const dotenv = require('dotenv');
dotenv.config();

const smsService = require('../src/services/sms.service');
const NotificationService = require('../src/services/notification.service');
const supabase = require('../src/config/supabase');

async function run() {
  console.log('🚀 Starting SMS Fallback Integration Verification...');

  // Save original env keys
  const origTwilioSid = process.env.TWILIO_ACCOUNT_SID;
  const origTwilioToken = process.env.TWILIO_AUTH_TOKEN;
  const origVonageKey = process.env.VONAGE_API_KEY;
  const origVonageSecret = process.env.VONAGE_API_SECRET;

  // Unconfigure Twilio (to force fallback)
  process.env.TWILIO_ACCOUNT_SID = 'invalid-or-missing';
  process.env.TWILIO_AUTH_TOKEN = 'invalid';

  // Configure Vonage mock credentials
  process.env.VONAGE_API_KEY = 'mock_vonage_key';
  process.env.VONAGE_API_SECRET = 'mock_vonage_secret';
  process.env.VONAGE_FROM_NUMBER = 'NovaStoreMock';

  // Mock global fetch to intercept Vonage API post
  const originalFetch = global.fetch;
  let fetchCalled = false;
  let requestBody = null;

  global.fetch = async (url, options) => {
    if (url.includes('nexmo.com') || url.includes('vonage.com')) {
      fetchCalled = true;
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          messages: [
            {
              status: '0',
              'message-id': 'mock-vonage-msg-999',
              'error-text': ''
            }
          ]
        })
      };
    }
    return originalFetch(url, options);
  };

  try {
    // 1. Trigger SMS send with unconfigured Twilio & configured Vonage
    console.log('Sending SMS (should fall back to Vonage)...');
    const result = await smsService.send('+2348000000000', 'Hello fallback SMS!');
    console.log('SMS Result:', result);

    if (!result.success) {
      throw new Error(`Expected success, got failure: ${result.error}`);
    }
    if (result.provider !== 'vonage') {
      throw new Error(`Expected provider to be "vonage", got: "${result.provider}"`);
    }
    if (!fetchCalled) {
      throw new Error('Verification failed: Vonage HTTP API was not called!');
    }
    if (requestBody.text !== 'Hello fallback SMS!') {
      throw new Error(`Verification failed: Expected body message "Hello fallback SMS!", got: "${requestBody.text}"`);
    }
    console.log('✅ Success: SMS successfully fell back to Vonage HTTP client.');

    // 2. Verify logging works in NotificationService with the new provider name
    // Find target user ID
    let targetUserId = null;
    const { data: users } = await supabase.from('users').select('id, phone_number').not('phone_number', 'is', null).limit(1);
    if (users && users.length > 0) {
      targetUserId = users[0].id;
      const targetPhone = users[0].phone_number;
      console.log(`Using user ID: ${targetUserId} with phone: ${targetPhone}`);

      // We stub sendToUser internally or mock it.
      // To simulate SMS channel, we can update user notification settings using the model
      const NotificationSettingModel = require('../src/models/notification-setting.model');
      const originalSettings = await NotificationSettingModel.getSettings(targetUserId);
      await NotificationSettingModel.updateSettings(targetUserId, {
        sms_order_updates: true
      });

      try {
        console.log('Sending notification (sync) to test user SMS logging...');
        // Let's create a test template that has SMS channel enabled
        const { data: template } = await supabase.from('notification_templates').insert([{
          key: 'test_sms_fallback_tmpl',
          name: 'Test SMS Fallback Template',
          subject: 'Order Confirmation',
          text_template: 'Your order {{orderNumber}} has been confirmed.',
          channel: ['sms']
        }]).select().single();

        console.log('Inserted template:', template);

        // Fetch user and settings via model to see exactly what NotificationService sees
        const userDb = await require('../src/models/user.model').findById(targetUserId);
        const settingsDb = await require('../src/models/notification-setting.model').getSettings(targetUserId);
        console.log('User in DB:', userDb);
        console.log('Settings in DB:', settingsDb);

        try {
          // Clear older logs to avoid conflicts
          await supabase.from('sms_logs').delete().eq('phone', targetPhone);

          const result = await NotificationService.sendToUser(targetUserId, 'test_sms_fallback_tmpl', { orderNumber: '1111' }, null, null, { async: false });
          console.log('Notification send result:', result);

          // Fetch the latest SMS log from the database
          const { data: latestLog, error: logErr } = await supabase
            .from('sms_logs')
            .select('*')
            .eq('phone', targetPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (logErr) throw logErr;
          console.log('Latest SMS Log in DB:', latestLog);

          if (!latestLog) {
            throw new Error('Verification failed: SMS log was not created in the database!');
          }
          if (latestLog.provider !== 'vonage') {
            throw new Error(`Verification failed: Expected provider in SMS log to be "vonage", got: "${latestLog.provider}"`);
          }
          console.log('✅ Success: SMS log contains correct fallback provider name.');

        } finally {
          await supabase.from('notification_templates').delete().eq('key', 'test_sms_fallback_tmpl');
        }
      } finally {
        if (originalSettings) {
          await supabase.from('notification_settings').upsert(originalSettings);
        } else {
          await supabase.from('notification_settings').delete().eq('user_id', targetUserId);
        }
      }
    }

    console.log('🎉 SMS FALLBACK VERIFICATION PASSED!');

  } finally {
    // Restore
    global.fetch = originalFetch;
    process.env.TWILIO_ACCOUNT_SID = origTwilioSid;
    process.env.TWILIO_AUTH_TOKEN = origTwilioToken;
    process.env.VONAGE_API_KEY = origVonageKey;
    process.env.VONAGE_API_SECRET = origVonageSecret;
    console.log('Done.');
  }
}

run().catch(err => {
  console.error('❌ SMS fallback verification failed:', err);
  process.exit(1);
});
