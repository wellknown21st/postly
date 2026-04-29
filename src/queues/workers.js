const { Worker } = require('bullmq');
const { createRedisConnection } = require('../config/redis');
const prisma = require('../config/database');
const logger = require('../utils/logger');
// Mock services for external APIs (to be replaced with actual SDK integrations)
const socialMediaService = require('../services/socialMediaService');

const connection = createRedisConnection();

const processPublishJob = async (job) => {
  const { platformPostId, platform, socialAccountId } = job.data;
  
  logger.info(`Processing job ${job.id} for platform post ${platformPostId}`);

  try {
    // 1. Fetch the platform post and social account
    const platformPost = await prisma.platformPost.findUnique({
      where: { id: platformPostId },
      include: { socialAccount: true, post: true }
    });

    if (!platformPost) {
      throw new Error(`PlatformPost ${platformPostId} not found`);
    }

    // Update status to PUBLISHING
    await prisma.platformPost.update({
      where: { id: platformPostId },
      data: { status: 'PUBLISHING', attempts: platformPost.attempts + 1 }
    });

    // 2. Publish to the specific platform
    let externalPostId;
    try {
      externalPostId = await socialMediaService.publish(
        platformPost.socialAccount,
        platformPost.content,
        platformPost.post.postType
      );
    } catch (publishError) {
      // Re-throw to trigger retry logic
      throw publishError;
    }

    // 3. Update status on success
    await prisma.platformPost.update({
      where: { id: platformPostId },
      data: { 
        status: 'PUBLISHED', 
        platformPostId: externalPostId,
        publishedAt: new Date(),
        errorMessage: null
      }
    });

    // 4. Check if all platform posts for the parent post are published
    const allPlatformPosts = await prisma.platformPost.findMany({
      where: { postId: platformPost.postId }
    });

    const allPublished = allPlatformPosts.every(p => p.status === 'PUBLISHED');
    const anyFailed = allPlatformPosts.some(p => p.status === 'FAILED');

    if (allPublished) {
      await prisma.post.update({
        where: { id: platformPost.postId },
        data: { status: 'PUBLISHED', publishedAt: new Date() }
      });
    } else if (anyFailed) {
      await prisma.post.update({
        where: { id: platformPost.postId },
        data: { status: 'PARTIAL' } // Or keep it as is if we want to wait for all
      });
    }

    logger.info(`Successfully published job ${job.id} to ${platform}`);
    return { success: true, externalPostId };

  } catch (error) {
    logger.error(`Job ${job.id} failed:`, error.message);

    // Update DB with error
    await prisma.platformPost.update({
      where: { id: platformPostId },
      data: { 
        status: 'FAILED',
        errorMessage: error.message
      }
    });

    // Update parent post status
    const pp = await prisma.platformPost.findUnique({ where: { id: platformPostId } });
    if (pp) {
      await prisma.post.update({
        where: { id: pp.postId },
        data: { status: 'FAILED' }
      });
    }

    throw error; // Let BullMQ handle retries
  }
};

const startWorkers = async () => {
  const worker = new Worker(
    'publish-post-queue',
    processPublishJob,
    {
      connection,
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY) || 5,
      settings: {
        backoffStrategies: {
          custom_exponential: (attemptsMade, err, jobsOptions) => {
            // 1s -> 5s -> 25s
            if (attemptsMade === 1) return 1000;
            if (attemptsMade === 2) return 5000;
            return 25000;
          }
        }
      }
    }
  );

  worker.on('completed', job => {
    logger.info(`[Worker] Job ${job.id} has completed!`);
  });

  worker.on('failed', (job, err) => {
    logger.warn(`[Worker] Job ${job.id} has failed with ${err.message}`);
  });

  return worker;
};

module.exports = { startWorkers };
