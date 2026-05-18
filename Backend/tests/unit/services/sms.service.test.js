const smsService = require('../../../src/services/sms.service');
const logger = require('../../../src/utils/logger');
const twilio = require('twilio');

jest.mock('../../../src/utils/logger');
jest.mock('twilio');

describe('SMSService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // clears cache
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should fall back to stub successfully in non-production environments when client is not initialized', async () => {
      process.env.NODE_ENV = 'development';
      
      // Ensure twilio client is null
      smsService.client = null;

      const result = await smsService.send('+2348000000000', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('stub-sms-');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Twilio client not initialized'));
    });

    it('should fail in production environment if Twilio credentials are not configured', async () => {
      process.env.NODE_ENV = 'production';
      
      // Force client to be null
      smsService.client = null;

      const result = await smsService.send('+2348000000000', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Twilio provider credentials missing in production');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot send SMS in production environment'));
    });

    it('should successfully attempt to send through Twilio SDK when client is initialized', async () => {
      // Mock Twilio messages.create function
      const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM123456' });
      smsService.client = {
        messages: {
          create: mockCreate
        }
      };

      const result = await smsService.send('+2348000000000', 'Test message');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM123456');
      expect(mockCreate).toHaveBeenCalledWith({
        body: 'Test message',
        from: smsService.fromNumber,
        to: '+2348000000000'
      });
    });

    it('should capture and return errors when Twilio SDK throws an error', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('Twilio limit exceeded'));
      smsService.client = {
        messages: {
          create: mockCreate
        }
      };

      const result = await smsService.send('+2348000000000', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Twilio limit exceeded');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error sending SMS via Twilio'), expect.any(Error));
    });
  });
});
