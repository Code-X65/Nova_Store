const supabase = require('../config/supabase');

class SmsLogModel {
  async log(data) {
    const { error } = await supabase
      .from('sms_logs')
      .insert([data]);
    
    if (error) console.error('Failed to log SMS:', error);
  }
}

module.exports = new SmsLogModel();
