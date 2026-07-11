const { startWorker, shutdownWorker } = require('../../src/services/notification-queue.service');
const { redisClient } = require('../../src/config/redis');
const NotificationService = require('../../src/services/notification.service');

jest.mock('../../src/config/redis', () => ({
  redisClient: {
    on: jest.fn(),
    publish: jest.fn().mockResolvedValue(1),
    zRangeByScore: jest.fn(),
    multi: jest.fn(),
    zRem: jest.fn(),
    hSet: jest.fn(),
    hDel: jest.fn(),
    hGetAll: jest.fn(),
    zAdd: jest.fn()
  }
}));

jest.mock('../../src/services/notification.service');
jest.mock('../../src/utils/logger');

describe('Notification Queue Worker - Unit Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await shutdownWorker();
    jest.useRealTimers();
  });

  describe('startWorker & Dequeue Loop', () => {
    it('should query and process pending jobs from Redis sorted set', async () => {
      const mockPipeline = {
        zRem: jest.fn().mockReturnThis(),
        hSet: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      };
      redisClient.multi.mockReturnValue(mockPipeline);

      const mockJobPayload = JSON.stringify({
        userId: 'user-789',
        templateKey: 'welcome_email',
        data: { name: 'Alice' },
        attempts: 0
      });
      redisClient.zRangeByScore.mockResolvedValueOnce([mockJobPayload]);
      NotificationService.sendToUser.mockResolvedValueOnce(true);
      redisClient.hDel.mockResolvedValueOnce(1);

      await startWorker();

      // Trigger the interval
      await jest.advanceTimersByTimeAsync(5000);

      expect(redisClient.zRangeByScore).toHaveBeenCalled();
      expect(redisClient.multi).toHaveBeenCalled();
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(
        'user-789',
        'welcome_email',
        { name: 'Alice' },
        null,
        null,
        { async: false }
      );
      expect(redisClient.hDel).toHaveBeenCalled();
    });

    it('should retry job with backoff if notification delivery fails', async () => {
      const mockPipeline = {
        zRem: jest.fn().mockReturnThis(),
        hSet: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      };
      redisClient.multi.mockReturnValue(mockPipeline);

      const mockJobPayload = JSON.stringify({
        userId: 'user-789',
        templateKey: 'welcome_email',
        data: {},
        attempts: 0
      });
      redisClient.zRangeByScore.mockResolvedValueOnce([mockJobPayload]);
      NotificationService.sendToUser.mockRejectedValueOnce(new Error('SMTP Offline'));
      redisClient.hDel.mockResolvedValueOnce(1);
      redisClient.zAdd.mockResolvedValueOnce(1);

      await startWorker();

      await jest.advanceTimersByTimeAsync(5000);

      expect(redisClient.hDel).toHaveBeenCalled();
      expect(redisClient.zAdd).toHaveBeenCalledWith(
        'nova:notification:queue',
        expect.objectContaining({
          score: expect.any(Number),
          value: expect.stringContaining('"attempts":1')
        })
      );
    });

    it('should dump job into Dead-Letter Queue (DLQ) after 3 failures', async () => {
      const mockPipeline = {
        zRem: jest.fn().mockReturnThis(),
        hSet: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      };
      redisClient.multi.mockReturnValue(mockPipeline);

      const mockJobPayload = JSON.stringify({
        userId: 'user-789',
        templateKey: 'welcome_email',
        data: {},
        attempts: 2
      });
      redisClient.zRangeByScore.mockResolvedValueOnce([mockJobPayload]);
      NotificationService.sendToUser.mockRejectedValueOnce(new Error('Invalid Recipient'));
      redisClient.hDel.mockResolvedValueOnce(1);
      redisClient.hSet.mockResolvedValueOnce(1);

      await startWorker();

      await jest.advanceTimersByTimeAsync(5000);

      expect(redisClient.hDel).toHaveBeenCalled();
      expect(redisClient.hSet).toHaveBeenCalledWith(
        'nova:notification:dlq',
        expect.any(String),
        expect.stringContaining('"attempts":3')
      );
      expect(redisClient.zAdd).not.toHaveBeenCalled();
    });
  });

  describe('Stuck Job Recovery', () => {
    it('should recycle in-flight jobs that have timed out', async () => {
      const stuckTime = Date.now() - 90000;
      const mockInflightJobs = {
        'job-uuid-1': JSON.stringify({
          raw: JSON.stringify({ userId: 'u1', templateKey: 't1' }),
          inflightAt: stuckTime
        })
      };
      redisClient.hGetAll.mockResolvedValueOnce(mockInflightJobs);
      redisClient.hDel.mockResolvedValueOnce(1);
      redisClient.zAdd.mockResolvedValueOnce(1);

      await startWorker();

      await jest.advanceTimersByTimeAsync(120000);

      expect(redisClient.hGetAll).toHaveBeenCalledWith('nova:notification:inflight');
      expect(redisClient.hDel).toHaveBeenCalledWith('nova:notification:inflight', 'job-uuid-1');
      expect(redisClient.zAdd).toHaveBeenCalledWith('nova:notification:queue', expect.any(Object));
    });
  });
});
