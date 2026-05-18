const supabase = require('../config/supabase');

class EmailLogModel {
  async log(data) {
    const { error } = await supabase
      .from('email_logs')
      .insert([data]);
    
    if (error) console.error('Failed to log email:', error);
  }
}

module.exports = new EmailLogModel();
