const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

// 🔥 Common options for Upstash
const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  tls: {} // ✅ REQUIRED for Upstash (rediss://)
};

const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL not found in environment variables");
  }

  // 🔥 Always use REDIS_URL (no localhost fallback in production)
  redisClient = new Redis(process.env.REDIS_URL, redisOptions);

  redisClient.on('connect', () => logger.info('✅ Redis connected'));
  redisClient.on('error', (err) => logger.error('❌ Redis error:', err.message));

  try {
    await redisClient.connect(); // ensures connection starts
    await redisClient.ping();    // test connection
  } catch (err) {
    logger.error("❌ Redis connection failed:", err.message);
  }

  return redisClient;
};

const getRedis = () => {
  if (!redisClient) throw new Error('Redis not connected. Call connectRedis() first.');
  return redisClient;
};

// 🔥 BullMQ requires separate connection instance
const createRedisConnection = () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL not found");
  }

  return new Redis(process.env.REDIS_URL, redisOptions);
};

module.exports = { connectRedis, getRedis, createRedisConnection };
