const prisma = require('../config/database');
const response = require('../utils/response');

/**
 * GET /api/dashboard/stats
 */
const getStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalPosts,
      publishedPosts,
      failedPosts,
      scheduledPosts,
      socialAccountsCount,
      recentPosts,
      platformBreakdown,
    ] = await Promise.all([
      prisma.post.count({ where: { userId } }),
      prisma.post.count({ where: { userId, status: 'PUBLISHED' } }),
      prisma.post.count({ where: { userId, status: 'FAILED' } }),
      prisma.post.count({ where: { userId, status: 'SCHEDULED' } }),
      prisma.socialAccount.count({ where: { userId, isActive: true } }),
      prisma.post.findMany({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
        select: {
          id: true, status: true, postType: true,
          createdAt: true, publishedAt: true,
          platformPosts: { select: { platform: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.platformPost.groupBy({
        by: ['platform'],
        where: { post: { userId } },
        _count: { platform: true },
      }),
    ]);

    const successRate = totalPosts > 0
      ? Math.round((publishedPosts / totalPosts) * 100)
      : 0;

    return response.success(res, {
      overview: {
        totalPosts,
        publishedPosts,
        failedPosts,
        scheduledPosts,
        connectedAccounts: socialAccountsCount,
        successRate: `${successRate}%`,
      },
      platformBreakdown: platformBreakdown.map(p => ({
        platform: p.platform,
        count: p._count.platform,
      })),
      recentPosts,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats };
