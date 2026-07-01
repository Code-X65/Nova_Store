const dotenv = require('dotenv');
dotenv.config();

const { startWorker, shutdownWorker } = require('../src/services/notification-queue.service');
const { redisClient } = require('../src/config/redis');

async function run() {
  console.log('🚀 Starting Redis Reconnection Worker Verification...');

  // Save original state & methods
  const originalIsOpen = redisClient.isOpen;
  const originalConnect = redisClient.connect;

  let reconnectCalled = false;

  // Force socket close
  Object.defineProperty(redisClient, 'isOpen', {
    value: false,
    writable: true,
    configurable: true
  });

  redisClient.connect = async () => {
    reconnectCalled = true;
    console.log('ℹ️ Mock redisClient.connect() called. Restoring connection state...');
    redisClient.isOpen = true;
    return Promise.resolve();
  };

  try {
    console.log('Starting worker (should trigger connection warning and reconnect)...');
    await startWorker();

    // Wait 6 seconds (to guarantee poll interval triggers at 5s)
    await new Promise(resolve => setTimeout(resolve, 6000));

    console.log(`reconnectCalled: ${reconnectCalled}`);
    console.log(`redisClient.isOpen: ${redisClient.isOpen}`);

    if (!reconnectCalled) {
      throw new Error('Verification failed: redisClient.connect was not called on closed socket!');
    }
    if (!redisClient.isOpen) {
      throw new Error('Verification failed: redisClient.isOpen was not set back to true!');
    }

    console.log('✅ Success: Worker correctly detected closed socket and executed reconnect!');
    console.log('🎉 REDIS WORKER RECONNECTION VERIFICATION PASSED!');

  } finally {
    console.log('Stopping worker...');
    await shutdownWorker();

    // Restore original client properties
    Object.defineProperty(redisClient, 'isOpen', {
      value: originalIsOpen,
      writable: true,
      configurable: true
    });
    redisClient.connect = originalConnect;
    console.log('Done.');
  }
}

run().catch(err => {
  console.error('❌ Redis worker reconnection verification failed:', err);
  process.exit(1);
});
