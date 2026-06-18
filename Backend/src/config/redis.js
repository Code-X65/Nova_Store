const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis reconnect limits exceeded. Stopping reconnection attempts.');
        return new Error('Redis connection lost permanently');
      }
      const delay = Math.min(100 * Math.pow(2, retries), 3000);
      console.warn(`Redis connection lost. Retrying in ${delay}ms... (Attempt ${retries})`);
      return delay;
    }
  }
});

redisClient.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.warn('Redis connection refused. Is Redis running?');
  } else {
    console.log('Redis Client Error', err);
  }
});
redisClient.on('connect', () => console.log('Redis Connected'));

const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL ERROR: Failed to connect to Redis in production. Exiting...', err);
      process.exit(1);
    }
    console.warn('Failed to connect to Redis. Proceeding without Redis...');
    // We don't exit the process here to allow local dev without Redis
  }
};

module.exports = { redisClient, connectRedis };
