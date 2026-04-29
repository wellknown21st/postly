const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

const baseOptions = {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
};

// 🔥 Detect if using Upstash (TLS required)
const getRedisOptions = () => {
  if (process.env.REDIS_URL && process.env.REDIS_URL.startsWith('rediss://')) {
    return {
      ...baseOptions,
      tls: {} // ✅ REQUIRED for Upstash
    };
  }
  return baseOptions;
};

const connectRedis = async () => {
  const options = getRedisOptions();

  redisClient = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, options)
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        ...options
      });

  redisClient.on('connect', () => logger.info('Redis connected'));
  redisClient.on('error', (err) => logger.error('Redis error:', err));

  await redisClient.ping();
  return redisClient;
};

const getRedis = () => {
  if (!redisClient) throw new Error('Redis not connected.');
  return redisClient;
};

// 🔥 FIX FOR BullMQ CONNECTION
const createRedisConnection = () => {
  const options = getRedisOptions();

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
