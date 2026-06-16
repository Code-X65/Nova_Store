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
        if (process.env.NODE_ENV !== 'production') {
          logger.warn(`Twilio client not initialized. Falling back to stub SMS in ${process.env.NODE_ENV || 'development'} environment.`);
          return { success: true, messageId: `stub-sms-${Date.now()}` };
        }
        
        logger.error('Cannot send SMS in production environment: Twilio provider credentials missing in production');
        return { success: false, error: 'Twilio provider credentials missing in production' };
      }

      const formattedTo = to.startsWith('+') ? to : `+${to}`;
      logger.info(`Sending SMS via Twilio to ${formattedTo}`);
      
      const response = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedTo
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
