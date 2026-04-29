const { Queue } = require('bullmq');
const { createRedisConnection } = require('../config/redis');

// Create dedicated Redis connection for the queue
const connection = createRedisConnection();

const publishQueue = new Queue('publish-post-queue', {
  connection,
  defaultJobOptions: {
    attempts: parseInt(process.env.JOB_ATTEMPTS) || 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s -> 2s -> 4s (Custom backoff strategy handles 1s -> 5s -> 25s)
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

module.exports = { publishQueue };
