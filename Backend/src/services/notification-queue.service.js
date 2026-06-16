const { redisClient } = require('../config/redis');
const NotificationService = require('./notification.service');
const logger = require('../utils/logger');

const QUEUE_KEY = 'nova:notification:queue';   // sorted-set, score = unix ts (ms)
const HEARTBEAT_INTERVAL_MS = 5_000;           // poll every 5 s
const BATCH_SIZE = 50;

let isWorkerRunning = false;

/**
 * Enqueue a notification for async delivery.
 * Jobs are stored in a Redis sorted-set keyed by delivery timestamp (ms).
 *
 * @param {object} job
 * @param {string} job.userId        — recipient user id
 * @param {string} job.templateKey   — notification template key
 * @param {object} job.data          — template substitution data
 * @param {number} [job.delayMs=0]   — optional delay before delivery
 * @param {string} [job.requestId]   — optional correlation id for tracing
 */
async function enqueue(job) {
  const { userId, templateKey, data = {}, delayMs = 0, requestId } = job;
  const deliverAt = Date.now() + delayMs;

  try {
    await redisClient.zAdd(QUEUE_KEY, { score: deliverAt, value: JSON.stringify({ userId, templateKey, data, requestId }) });
  } catch (err) {
    logger.error('[NotifyQueue] Failed to enqueue notification:', err.message);
    throw err;
  }
}

/**
 * Internal pop-and-dispatch loop.
 * Pops all jobs whose score ≤ now  and calls NotificationService.sendToUser for each.
 * Failures are logged but never crash the worker.
 */
async function _dequeueBatch() {
  const now = Date.now();

  const batch = await redisClient
    .zRangeByScore(QUEUE_KEY, 0, now, { LIMIT: { offset: 0, count: BATCH_SIZE } })
    .catch(() => []);

  if (batch.length === 0) return;

  const pipeline = redisClient.multi();
  for (const item of batch) {
    pipeline.zRem(QUEUE_KEY, item);
  }
  await pipeline.exec().catch(() => {});

  for (const raw of batch) {
    let job;
    try {
      job = JSON.parse(raw);
    } catch {
      logger.warn('[NotifyQueue] Skipping malformed job:', raw);
      continue;
    }
    try {
      await NotificationService.sendToUser(job.userId, job.templateKey, job.data, null, null, { async: false });
      logger.debug(`[NotifyQueue] Delivered ${job.templateKey} → user ${job.userId}`);
    } catch (err) {
      logger.error(`[NotifyQueue] Failed to deliver ${job.templateKey} → user ${job.userId}:`, err.message);
      // Re-enqueue with a 1-minute back-off to avoid losing the notification entirely
      await enqueue({
        ...job,
        delayMs: 60_000,
      }).catch(() => {});
    }
  }
}

/**
 * Start the background worker loop.
 * Idempotent — safe to call multiple times from server.js.
 */
async function startWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  logger.info('[NotifyQueue] Worker started — polling every 5 s');

  setInterval(async () => {
    try {
      await _dequeueBatch();
    } catch (err) {
      logger.error('[NotifyQueue] Worker tick error:', err.message);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Return a pending job count (for health-check endpoints / admin dashboards).
 */
async function getPendingCount() {
  try {
    return await redisClient.zCard(QUEUE_KEY);
  } catch {
    return 0;
  }
}

module.exports = { enqueue, startWorker, getPendingCount };
