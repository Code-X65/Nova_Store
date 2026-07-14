const { redisClient } = require('../config/redis');
const bulkImportService = require('../services/bulk-import.service');
const logger = require('../utils/logger');

/**
 * bulk-import.worker.js
 *
 * Consumes the `nova:import:queue` (Redis list, FIFO via LPUSH/RPOP) and
 * processes Excel import jobs. Mirrors the resilience pattern of the
 * notification queue (reconnect guard, swallow per-job errors).
 */

const QUEUE_KEY = 'nova:import:queue';
let isRunning = false;
let pollIntervalId = null;

async function _processOne() {
  let raw;
  try {
    raw = await redisClient.lPop(QUEUE_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  let job;
  try {
    job = JSON.parse(raw);
  } catch (err) {
    logger.error('[ImportWorker] Discarding malformed job:', err.message);
    return true;
  }

  try {
    await bulkImportService.processImport(job.jobId, job.filePath, job.entityType, job.userId);
  } catch (err) {
    logger.error(`[ImportWorker] Job ${job.jobId} failed:`, err.message);
  }
  return true;
}

async function _tick() {
  try {
    if (redisClient.isOpen === false) {
      if (typeof redisClient.connect === 'function') {
        await redisClient.connect().catch(() => {});
        if (redisClient.isOpen === false) return;
      } else {
        return;
      }
    }
    let more = true;
    while (more) {
      more = await _processOne();
    }
  } catch (err) {
    logger.error('[ImportWorker] tick error:', err.message);
  }
}

async function startImportWorker() {
  if (isRunning) return;
  isRunning = true;
  logger.info('[ImportWorker] started — polling every 3s');
  pollIntervalId = setInterval(_tick, 3000);
}

async function shutdownImportWorker() {
  if (!isRunning) return;
  if (pollIntervalId) clearInterval(pollIntervalId);
  isRunning = false;
  logger.info('[ImportWorker] stopped');
}

module.exports = { startImportWorker, shutdownImportWorker };
