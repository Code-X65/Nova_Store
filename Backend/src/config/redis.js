const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: false // Disable infinite retries if Redis is not running
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
    console.warn('Failed to connect to Redis. Proceeding without Redis...');
    // We don't exit the process here to allow local dev without Redis
  }
};

module.exports = { redisClient, connectRedis };
