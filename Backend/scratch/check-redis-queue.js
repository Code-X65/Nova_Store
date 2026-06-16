require('dotenv').config();
const { redisClient, connectRedis } = require('../src/config/redis');

async function run() {
  await connectRedis();
  const QUEUE_KEY = 'nova:notification:queue';
  
  const count = await redisClient.zCard(QUEUE_KEY);
  console.log('Total queued notification jobs:', count);
  
  if (count > 0) {
    const jobs = await redisClient.zRangeWithScores(QUEUE_KEY, 0, -1);
    console.log('Queued Jobs:', JSON.stringify(jobs, null, 2));
  }
  process.exit(0);
}

run();
