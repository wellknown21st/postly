const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

const redisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

const connectRedis = async () => {
  redisClient = process.env.REDIS_URL 
    ? new Redis(process.env.REDIS_URL, redisOptions)
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        ...redisOptions
      });

  redisClient.on('connect', () => logger.info('Redis connected'));
  redisClient.on('error', (err) => logger.error('Redis error:', err));

  // Test connection
  await redisClient.ping();
  return redisClient;
};

const getRedis = () => {
  if (!redisClient) throw new Error('Redis not connected. Call connectRedis() first.');
  return redisClient;
};

// Create a new connection for BullMQ (requires separate connections)
const createRedisConnection = () => {
  const options = { maxRetriesPerRequest: null };
  return process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, options)
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        ...options
      });
};

module.exports = { connectRedis, getRedis, createRedisConnection };
