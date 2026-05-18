const logger = require('../utils/logger');
const twilio = require('twilio');

class SMSService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER;
    
    this.client = null;
    
    // Initialize client only if credentials are provided and valid (starts with AC)
    if (this.accountSid && this.accountSid.startsWith('AC') && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  async send(to, message) {
    try {
      if (!this.client) {
        const errorMsg = 'Twilio provider credentials missing. SMS not sent.';
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      logger.info(`Sending SMS via Twilio to ${to}`);
      
      const response = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to
      });

      logger.info(`SMS sent successfully to ${to}. SID: ${response.sid}`);
      return { success: true, messageId: response.sid };
    } catch (error) {
      logger.error(`Error sending SMS via Twilio to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SMSService();
