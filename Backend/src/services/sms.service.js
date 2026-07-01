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
    let twilioError = null;

    // 1. Attempt Twilio if configured
    if (this.client) {
      try {
        const formattedTo = to.startsWith('+') ? to : `+${to}`;
        logger.info(`Sending SMS via Twilio to ${formattedTo}`);
        
        const response = await this.client.messages.create({
          body: message,
          from: this.fromNumber,
          to: formattedTo
        });

        logger.info(`SMS sent successfully to ${to}. SID: ${response.sid}`);
        return { success: true, messageId: response.sid, provider: 'twilio' };
      } catch (error) {
        logger.error(`Error sending SMS via Twilio to ${to}:`, error);
        twilioError = error.message;
      }
    }

    // 2. Attempt Vonage as fallback if configured
    const vonageKey = process.env.VONAGE_API_KEY;
    const vonageSecret = process.env.VONAGE_API_SECRET;
    const vonageFrom = process.env.VONAGE_FROM_NUMBER || 'NovaStore';

    if (vonageKey && vonageSecret) {
      try {
        logger.info(`Sending SMS via Vonage (fallback) to ${to}`);
        const cleanTo = to.replace('+', '');
        const response = await fetch('https://rest.nexmo.com/sms/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: vonageKey,
            api_secret: vonageSecret,
            to: cleanTo,
            from: vonageFrom,
            text: message
          })
        });

        if (!response.ok) {
          throw new Error(`Vonage HTTP error: ${response.status}`);
        }

        const data = await response.json();
        const messageStatus = data.messages?.[0]?.status;
        if (messageStatus !== '0') {
          throw new Error(`Vonage API error: ${data.messages?.[0]?.['error-text'] || 'Unknown error'}`);
        }

        const msgId = data.messages?.[0]?.['message-id'];
        logger.info(`SMS sent successfully to ${to} via Vonage. ID: ${msgId}`);
        return { success: true, messageId: msgId, provider: 'vonage' };
      } catch (error) {
        logger.error(`Vonage SMS fallback failed. Error: ${error.message}`);
        return { success: false, error: twilioError ? `Twilio failed (${twilioError}) & Vonage fallback failed (${error.message})` : error.message };
      }
    }

    // If Twilio was configured and failed, and Vonage was NOT configured, return the Twilio error
    if (this.client && twilioError) {
      return { success: false, error: twilioError };
    }

    // 3. Stub fallback for non-production environments
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(`Twilio client not initialized. Falling back to stub SMS in ${process.env.NODE_ENV || 'development'} environment.`);
      return { success: true, messageId: `stub-sms-${Date.now()}`, provider: 'stub' };
    }

    logger.error('Cannot send SMS in production environment: Twilio provider credentials missing in production');
    return { success: false, error: 'Twilio provider credentials missing in production' };
  }
}

module.exports = new SMSService();
