const prisma = require('../config/database');
const response = require('../utils/response');
const { publishQueue } = require('../queues/publishQueue');
const aiEngine = require('../services/aiEngine');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * POST /api/posts/publish
 * Generate + immediately publish content
 */
const publish = async (req, res, next) => {
  try {
    const {
      idea, post_type, platforms, tone, language, model,
      generated_content, // optional: skip generation if already done
    } = req.body;

    // Validate social accounts exist for each platform
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        userId: req.user.id,
        platform: { in: platforms },
        isActive: true,
      },
    });

    const connectedPlatforms = socialAccounts.map(a => a.platform);
    const missingPlatforms = platforms.filter(p => !connectedPlatforms.includes(p));

    if (missingPlatforms.length > 0) {
      return response.error(
        res,
        `No connected accounts for: ${missingPlatforms.join(', ')}`,
        400
      );
    }

    // Generate content if not provided
    let content = generated_content;
    if (!content) {
      const aiKeys = await prisma.aiKey.findUnique({ where: { userId: req.user.id } });
      const userKeys = {};
      if (aiKeys?.groqKey) userKeys.groq = decrypt(aiKeys.groqKey);

      const generated = await aiEngine.generate({
        idea, postType: post_type, platforms, tone, language, model, userKeys,
      });
      content = generated.platforms;
    }

    // Create post record
    const post = await prisma.post.create({
      data: {
        userId: req.user.id,
        idea,
        postType: post_type || 'TEXT',
        tone: tone || 'professional',
        language: language || 'en',
        aiModel: model || 'GROQ_LLAMA_3',
        generatedContent: content,
        status: 'QUEUED',
      },
    });

    // Create platform post records + enqueue jobs
    const platformPosts = [];
    for (const account of socialAccounts) {
      const platformContent = content[account.platform] || content[account.platform.toLowerCase()];
      if (!platformContent) continue;

      const platformPost = await prisma.platformPost.create({
        data: {
          postId: post.id,
          socialAccountId: account.id,
          platform: account.platform,
          content: typeof platformContent === 'string'
            ? platformContent
            : platformContent.content || JSON.stringify(platformContent),
          status: 'QUEUED',
        },
      });

      // Add to BullMQ queue
      const job = await publishQueue.add(
        'publish-post',
        {
          platformPostId: platformPost.id,
          platform: account.platform,
          socialAccountId: account.id,
          postId: post.id,
          userId: req.user.id,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        }
      );

      // Update with job ID
      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: { jobId: job.id },
      });

      platformPosts.push({ ...platformPost, jobId: job.id });
    }

    logger.info(`Post ${post.id} queued for ${socialAccounts.length} platforms`);

    return response.created(res, {
      post: {
        id: post.id,
        status: post.status,
        platforms: platformPosts.map(p => ({
          platform: p.platform,
          status: p.status,
          jobId: p.jobId,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/posts/schedule
 */
const schedule = async (req, res, next) => {
  try {
    const { idea, post_type, platforms, tone, language, model, scheduled_at, generated_content } = req.body;

    const scheduledDate = new Date(scheduled_at);
    if (scheduledDate <= new Date()) {
      return response.error(res, 'Scheduled time must be in the future', 400);
    }

    // Validate accounts
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { userId: req.user.id, platform: { in: platforms }, isActive: true },
    });

    if (socialAccounts.length === 0) {
      return response.error(res, 'No connected accounts for selected platforms', 400);
    }

    // Generate content
    let content = generated_content;
    if (!content) {
      const aiKeys = await prisma.aiKey.findUnique({ where: { userId: req.user.id } });
      const userKeys = {};
      if (aiKeys?.groqKey) userKeys.groq = decrypt(aiKeys.groqKey);

      const generated = await aiEngine.generate({
        idea, postType: post_type, platforms, tone, language, model, userKeys,
      });
      content = generated.platforms;
    }

    const post = await prisma.post.create({
      data: {
        userId: req.user.id,
        idea,
        postType: post_type || 'TEXT',
        tone: tone || 'professional',
        language: language || 'en',
        aiModel: model || 'GPT4O_MINI',
        generatedContent: content,
        status: 'SCHEDULED',
        scheduledAt: scheduledDate,
      },
    });

    // Schedule jobs
    const delay = scheduledDate.getTime() - Date.now();
    const platformPosts = [];

    for (const account of socialAccounts) {
      const platformContent = content[account.platform] || content[account.platform.toLowerCase()];
      if (!platformContent) continue;

      const platformPost = await prisma.platformPost.create({
        data: {
          postId: post.id,
          socialAccountId: account.id,
          platform: account.platform,
          content: typeof platformContent === 'string'
            ? platformContent
            : platformContent.content || JSON.stringify(platformContent),
          status: 'QUEUED',
        },
      });

      const job = await publishQueue.add(
        'publish-post',
        { platformPostId: platformPost.id, platform: account.platform, socialAccountId: account.id, postId: post.id, userId: req.user.id },
        {
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }
      );

      await prisma.platformPost.update({
        where: { id: platformPost.id },
        data: { jobId: job.id },
      });

      platformPosts.push({ platform: platformPost.platform, jobId: job.id });
    }

    return response.created(res, { post: { id: post.id, status: post.status, scheduledAt: post.scheduledAt, platforms: platformPosts } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/posts
 */
const getPosts = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10,
      status, platform,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { userId: req.user.id };

    if (status) where.status = status.toUpperCase();
    if (platform) {
      where.platformPosts = { some: { platform: platform.toUpperCase() } };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          platformPosts: {
            select: { platform: true, status: true, publishedAt: true, errorMessage: true },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    return response.paginated(res, posts, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/posts/:id
 */
const getPost = async (req, res, next) => {
  try {
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        platformPosts: {
          include: { socialAccount: { select: { platform: true, accountName: true } } },
        },
      },
    });

    if (!post) return response.notFound(res, 'Post not found');

    return response.success(res, post);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/posts/:id/retry
 */
const retryPost = async (req, res, next) => {
  try {
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { platformPosts: true },
    });

    if (!post) return response.notFound(res, 'Post not found');

    const failedPlatformPosts = post.platformPosts.filter(p => p.status === 'FAILED');

    if (failedPlatformPosts.length === 0) {
      return response.error(res, 'No failed platform posts to retry', 400);
    }

    const jobs = [];
    for (const pp of failedPlatformPosts) {
      await prisma.platformPost.update({
        where: { id: pp.id },
        data: { status: 'QUEUED', errorMessage: null },
      });

      const job = await publishQueue.add(
        'publish-post',
        { platformPostId: pp.id, platform: pp.platform, socialAccountId: pp.socialAccountId, postId: post.id, userId: req.user.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
      );

      jobs.push({ platform: pp.platform, jobId: job.id });
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { status: 'QUEUED' },
    });

    return response.success(res, { message: 'Retry jobs enqueued', jobs });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/posts/:id
 */
const deletePost = async (req, res, next) => {
  try {
    const post = await prisma.post.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!post) return response.notFound(res, 'Post not found');

    await prisma.post.delete({ where: { id: req.params.id } });

    return response.success(res, { message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { publish, schedule, getPosts, getPost, retryPost, deletePost };
