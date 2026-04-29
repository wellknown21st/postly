const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  const isTLS = process.env.REDIS_URL.startsWith('rediss://');

  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    ...(isTLS && {
      tls: {
        rejectUnauthorized: false, // 🔥 IMPORTANT for Upstash
      },
    }),
  });

  redisClient.on('connect', () => logger.info('Redis connected'));
  redisClient.on('error', (err) => logger.error('Redis error:', err));

  await redisClient.ping();
  return redisClient;
};

const getRedis = () => {
  if (!redisClient) throw new Error('Redis not connected');
  return redisClient;
};

const createRedisConnection = () => {
  const isTLS = process.env.REDIS_URL.startsWith('rediss://');

  return new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    ...(isTLS && {
      tls: {
        rejectUnauthorized: false, // 🔥 same fix here
      },
    }),
  });
};

module.exports = { connectRedis, getRedis, createRedisConnection };
