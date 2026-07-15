const dotenv = require('dotenv');
dotenv.config();
// Validate environment variables early
require('./config/env');

const errorTracker = require('./utils/error-tracker');

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...', err.message);
  errorTracker.captureException(err, { tags: { process: 'master', errorType: 'uncaughtException' } });
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! Shutting down...', err.message);
  const errorObj = err instanceof Error ? err : new Error(String(err));
  errorTracker.captureException(errorObj, { tags: { process: 'master', errorType: 'unhandledRejection' } });
  process.exit(1);
});

const app = require('./app');
const pgPool = require('./config/db');
const { connectRedis, redisClient } = require('./config/redis');
const CronJob = require('cron').CronJob;
const runCleanup = require('./jobs/cleanup.job.js');
const runReservationCleanup = require('./jobs/reservation-cleanup.job.js');
const runAbandonedCartCheck = require('./jobs/abandoned-cart.job.js');

const { startWorker: startNotifyWorker } = require('./services/notification-queue.service');
const { startImportWorker, shutdownImportWorker } = require('./services/bulk-import.worker');
const { initRealtime } = require('./realtime/sse.gateway');
const eventBus = require('./realtime/event-bus');
const notificationRouter = require('./services/notification-router.service');

const PORT = process.env.PORT || 5000;

// 1. Notification delivery worker — starts immediately on boot
startNotifyWorker().catch(err => console.error('[Server] Notify queue failed to start:', err.message));

// 1b. Bulk import worker — processes queued Excel ingestion jobs (Redis list)
startImportWorker().catch(err => console.error('[Server] Import worker failed to start:', err.message));

// 2. Daily garbage-collection: 02:00 UTC
new CronJob('0 2 * * *', runCleanup, null, true, 'UTC');

// 3. Stock reservation expiry cleanup: every 10 minutes
new CronJob('*/10 * * * *', runReservationCleanup, null, true, 'UTC');

// 3b. Abandoned cart reminder emails: every 30 minutes
new CronJob('*/30 * * * *', runAbandonedCartCheck, null, true, 'UTC');


// Real-time SSE subscriber (Redis Pub/Sub fan-out). Best-effort; SSE falls
// back to polling if Redis is unavailable.
initRealtime().catch(err => console.warn('[Server] Realtime init skipped:', err.message));

// Domain event bus (Redis Pub/Sub fan-out for cross-instance delivery) and the
// Role-Based Notification Routing Engine handlers.
eventBus.initRealtime().catch(err => console.warn('[Server] Event bus init skipped:', err.message));
notificationRouter.initHandlers();

// Auto-generate gross-NGN invoices when orders are delivered / paid
require('./services/invoice.service').initAutoInvoice();

let server;

// 3. Connect to databases and start HTTP server
const startServer = async () => {
  try {
    // Connect to Redis first
    await connectRedis();

    // Verify PostgreSQL connectivity with retries
    let pgConnected = false;
    const maxRetries = 5;
    const retryDelayMs = 2000;

    for (let i = 1; i <= maxRetries; i++) {
      try {
        const client = await pgPool.connect();
        client.release();
        console.log('✓ PostgreSQL Database connection verified successfully.');
        pgConnected = true;
        break;
      } catch (dbErr) {
        console.warn(`PostgreSQL connection attempt ${i}/${maxRetries} failed: ${dbErr.message}`);
        if (i < maxRetries) {
          console.log(`Retrying database connection in ${retryDelayMs / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        } else {
          throw dbErr;
        }
      }
    }

    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      console.log('🚪 HTTP server closed.');
    });
  }

  const { shutdownWorker } = require('./services/notification-queue.service');
  try {
    await shutdownWorker();
  } catch (err) {
    console.error('Error shutting down notification worker:', err.message);
  }

  try {
    await shutdownImportWorker();
  } catch (err) {
    console.error('Error shutting down import worker:', err.message);
  }

  // Disconnect Redis
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.disconnect();
      console.log('🚪 Redis client disconnected.');
    } catch (err) {
      console.error('Error disconnecting Redis client:', err.message);
    }
  }

  // Close PostgreSQL pool
  if (pgPool) {
    try {
      await pgPool.end();
      console.log('🚪 PostgreSQL database connection pool ended.');
    } catch (err) {
      console.error('Error ending PostgreSQL pool:', err.message);
    }
  }

  console.log('👋 Graceful shutdown complete. Exiting.');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
