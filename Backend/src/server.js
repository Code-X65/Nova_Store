const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const { connectRedis } = require('./config/redis');
const CronJob = require('cron').CronJob;
const runCleanup = require('./jobs/cleanup.job.js');
const { startWorker: startNotifyWorker } = require('./services/notification-queue.service');

const PORT = process.env.PORT || 5000;

// 1. Notification delivery worker — starts immediately on boot
startNotifyWorker().catch(err => console.error('[Server] Notify queue failed to start:', err.message));

// 2. Daily garbage-collection: 02:00 UTC
new CronJob('0 2 * * *', runCleanup, null, true, 'UTC');

// 3. Connect to databases and start HTTP server
const startServer = async () => {
  try {
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
