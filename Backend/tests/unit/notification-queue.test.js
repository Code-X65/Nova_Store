const { enqueue } = require('../../src/services/notification-queue.service');
const { redisClient } = require('../../src/config/redis');
const NotificationService = require('../../src/services/notification.service');
const logger = require('../../src/utils/logger');

jest.mock('../../src/config/redis', () => ({
  redisClient: {
    zAdd: jest.fn().mockResolvedValue(1),
    zRangeByScore: jest.fn(),
    multi: jest.fn(),
    hSet: jest.fn().mockResolvedValue(1),
    hDel: jest.fn().mockResolvedValue(1),
    zRem: jest.fn().mockResolvedValue(1),
  }
}));

jest.mock('../../src/services/notification.service');
jest.mock('../../src/utils/logger');

describe('Notification Queue Service - Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should successfully enqueue a job to Redis sorted set with attempts defaulted to 0', async () => {
      const job = {
        userId: 'user-123',
        templateKey: 'order_shipped',
        data: { orderId: 'order-456' },
        delayMs: 1000,
        requestId: 'req-id-111'
      };

      await enqueue(job);

      expect(redisClient.zAdd).toHaveBeenCalledWith('nova:notification:queue', expect.objectContaining({
        score: expect.any(Number),
        value: expect.any(String)
      }));

      const addedValue = JSON.parse(redisClient.zAdd.mock.calls[0][1].value);
      expect(addedValue).toEqual({
        userId: 'user-123',
        templateKey: 'order_shipped',
        data: { orderId: 'order-456' },
        requestId: 'req-id-111',
        attempts: 0
      });
    });

    it('should log an error and throw if zAdd fails', async () => {
      redisClient.zAdd.mockRejectedValueOnce(new Error('Redis is down'));
      const job = { userId: 'u1', templateKey: 't1' };

      await expect(enqueue(job)).rejects.toThrow('Redis is down');
      expect(logger.error).toHaveBeenCalledWith('[NotifyQueue] Failed to enqueue notification: Redis is down');
    });
  });
});
