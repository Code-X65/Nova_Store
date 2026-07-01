const { redisClient } = require('../config/redis');
const NotificationService = require('./notification.service');
const logger = require('../utils/logger');

const QUEUE_KEY      = 'nova:notification:queue';    // sorted-set, score = unix ts (ms)
const INFLIGHT_KEY   = 'nova:notification:inflight'; // hash  field=jobId  value=JSON
const HEARTBEAT_INTERVAL_MS  = 5_000;                // poll every 5 s
const VISIBILITY_TIMEOUT_MS  = 60_000;               // 1 min before a stuck job is recycled
const BATCH_SIZE     = 50;

let isWorkerRunning = false;
let isShuttingDown = false;
let activeProcessingPromises = 0;
let pollIntervalId = null;
let recoveryIntervalId = null;

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
  const { userId, templateKey, data = {}, delayMs = 0, requestId, attempts = 0 } = job;
  const deliverAt = Date.now() + delayMs;

  try {
    await redisClient.zAdd(QUEUE_KEY, {
      score: deliverAt,
      value: JSON.stringify({ userId, templateKey, data, requestId, attempts }),
    });
  } catch (err) {
    logger.error(`[NotifyQueue] Failed to enqueue notification: ${err.message}`);
    throw err;
  }
}

/**
 * Internal pop-and-dispatch loop.
 *
 * Atomically moves each ready job from the pending sorted-set into the
 * in-flight hash (field = unique jobId, value = JSON + inflightAt timestamp).
 * After successful delivery the job is removed from the hash.
 * On failure the job is re-enqueued with a back-off and removed from in-flight.
 */
async function _dequeueBatch() {
  const now = Date.now();

  const batch = await redisClient
    .zRangeByScore(QUEUE_KEY, 0, now, { LIMIT: { offset: 0, count: BATCH_SIZE } })
    .catch(() => []);

  if (batch.length === 0) return;

  // Atomically remove from queue and mark in-flight in a single pipeline
  const pipeline = redisClient.multi();
  const inflightEntries = [];
  for (const item of batch) {
    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    pipeline.zRem(QUEUE_KEY, item);
    pipeline.hSet(INFLIGHT_KEY, jobId, JSON.stringify({ raw: item, inflightAt: Date.now() }));
    inflightEntries.push({ jobId, raw: item });
  }
  await pipeline.exec().catch(() => {});

  for (const { jobId, raw } of inflightEntries) {
    let job;
    try {
      job = JSON.parse(raw);
    } catch {
      logger.warn('[NotifyQueue] Skipping malformed job:', raw);
      await redisClient.hDel(INFLIGHT_KEY, jobId).catch(() => {});
      continue;
    }

    try {
      await NotificationService.sendToUser(job.userId, job.templateKey, job.data, null, null, { async: false });
      logger.debug(`[NotifyQueue] Delivered ${job.templateKey} → user ${job.userId}`);
      // Remove from in-flight only after confirmed delivery
      await redisClient.hDel(INFLIGHT_KEY, jobId).catch(() => {});
    } catch (err) {
      logger.error(`[NotifyQueue] Failed to deliver ${job.templateKey} → user ${job.userId}: ${err.message}`);
      
      const attempts = (job.attempts || 0) + 1;
      const MAX_ATTEMPTS = 3;

      // Clean up in-flight status first
      await redisClient.hDel(INFLIGHT_KEY, jobId).catch(() => {});

      if (attempts >= MAX_ATTEMPTS) {
        // Send to Dead-Letter Queue
        const dlqPayload = JSON.stringify({ ...job, attempts, error: err.message, failedAt: Date.now() });
        await redisClient.hSet('nova:notification:dlq', jobId, dlqPayload).catch(() => {});
        logger.error(`[NotifyQueue] Job ${jobId} exceeded max attempts (${MAX_ATTEMPTS}). Sent to DLQ. Recipient: ${job.userId}`);
      } else {
        // Re-enqueue with exponential back-off
        const delayMs = attempts * 60_000;
        await enqueue({ ...job, attempts, delayMs }).catch(() => {});
        logger.info(`[NotifyQueue] Re-enqueuing job ${jobId} (attempt ${attempts}) in ${delayMs / 1000}s`);
      }
    }
  }
}

/**
 * Recover jobs that have been in-flight beyond VISIBILITY_TIMEOUT_MS.
 * This handles process-crash scenarios where a job was dequeued but never
 * acknowledged.
 */
async function _recoverStuckJobs() {
  const cutoff = Date.now() - VISIBILITY_TIMEOUT_MS;
  try {
    const inflight = await redisClient.hGetAll(INFLIGHT_KEY);
    for (const [jobId, value] of Object.entries(inflight)) {
      let entry;
      try { entry = JSON.parse(value); } catch { continue; }
      if (entry.inflightAt < cutoff) {
        logger.warn(`[NotifyQueue] Recovering stuck job ${jobId} (in-flight since ${new Date(entry.inflightAt).toISOString()})`);
        await redisClient.hDel(INFLIGHT_KEY, jobId).catch(() => {});
        // Re-enqueue with a short delay so it doesn't fire immediately
        let job;
        try { job = JSON.parse(entry.raw); } catch { continue; }
        await enqueue({ ...job, delayMs: 5_000 }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error(`[NotifyQueue] Stuck-job recovery error: ${err.message}`);
  }
}

/**
 * Start the background worker loop.
 * Idempotent — safe to call multiple times from server.js.
 */
async function startWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  isShuttingDown = false;

  logger.info('[NotifyQueue] Worker started — polling every 5 s');

  // Main delivery loop
  pollIntervalId = setInterval(async () => {
    if (isShuttingDown) return;
    try {
      // Reconnection guard: check if Redis client is open
      if (redisClient.isOpen === false) {
        if (typeof redisClient.connect === 'function') {
          logger.warn('[NotifyQueue] Redis client is closed. Attempting to reconnect...');
          await redisClient.connect().catch(err => {
            logger.error(`[NotifyQueue] Reconnection attempt failed: ${err.message}`);
          });
          if (redisClient.isOpen === false) {
            logger.warn('[NotifyQueue] Reconnection failed, skipping this tick.');
            return;
          }
          logger.info('[NotifyQueue] Reconnected to Redis successfully.');
        } else {
          logger.warn('[NotifyQueue] Redis client is closed but connect method is not available.');
        }
      }

      activeProcessingPromises++;
      await _dequeueBatch();
    } catch (err) {
      logger.error(`[NotifyQueue] Worker tick error: ${err.message}`);
    } finally {
      activeProcessingPromises--;
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Stuck-job recovery runs every 2 minutes
  recoveryIntervalId = setInterval(async () => {
    if (isShuttingDown) return;
    try {
      if (redisClient.isOpen === false) return; // Skip recovery tick if Redis is closed
      activeProcessingPromises++;
      await _recoverStuckJobs();
    } catch (err) {
      logger.error(`[NotifyQueue] Stuck-job recovery error: ${err.message}`);
    } finally {
      activeProcessingPromises--;
    }
  }, 2 * 60 * 1_000);
}

/**
 * Stop the worker and wait for active jobs to complete.
 */
async function shutdownWorker() {
  if (!isWorkerRunning) return;
  logger.info('[NotifyQueue] Initiating graceful worker shutdown...');
  isShuttingDown = true;

  if (pollIntervalId) clearInterval(pollIntervalId);
  if (recoveryIntervalId) clearInterval(recoveryIntervalId);

  // Wait up to 10 seconds for active jobs to complete
  const startTime = Date.now();
  while (activeProcessingPromises > 0 && Date.now() - startTime < 10000) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  isWorkerRunning = false;
  logger.info('[NotifyQueue] Worker shut down gracefully.');
}

/**
 * Return a snapshot of queue health metrics (for health-check / admin dashboard).
 * @returns {Promise<{ pending: number, inflight: number }>}
 */
async function getQueueStats() {
  try {
    const [pending, inflight, failed] = await Promise.all([
      redisClient.zCard(QUEUE_KEY).catch(() => 0),
      redisClient.hLen(INFLIGHT_KEY).catch(() => 0),
      redisClient.hLen('nova:notification:dlq').catch(() => 0),
    ]);
    return { pending, inflight, failed };
  } catch {
    return { pending: 0, inflight: 0, failed: 0 };
  }
}

/**
 * Return a pending job count (for health-check endpoints / admin dashboards).
 * @deprecated Use getQueueStats() for richer metrics.
 */
async function getPendingCount() {
  const { pending } = await getQueueStats();
  return pending;
}

module.exports = { enqueue, startWorker, shutdownWorker, getPendingCount, getQueueStats };

