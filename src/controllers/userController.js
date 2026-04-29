const prisma = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');
const response = require('../utils/response');

/**
 * PUT /api/user/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, bio, avatarUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, bio, avatarUrl },
      select: {
        id: true, email: true, username: true, name: true,
        bio: true, avatarUrl: true, updatedAt: true,
      },
    });

    return response.success(res, user);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/user/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, username: true, name: true,
        bio: true, avatarUrl: true, telegramChatId: true, createdAt: true,
        _count: { select: { posts: true, socialAccounts: true } },
      },
    });

    return response.success(res, user);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/user/social-accounts
 */
const addSocialAccount = async (req, res, next) => {
  try {
    const { platform, accountId, accountName, accessToken, refreshToken, tokenExpiresAt } = req.body;

    const account = await prisma.socialAccount.upsert({
      where: { userId_platform: { userId: req.user.id, platform } },
      update: {
        accountId,
        accountName,
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        isActive: true,
      },
      create: {
        userId: req.user.id,
        platform,
        accountId,
        accountName,
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
      },
    });

    return response.created(res, {
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      isActive: account.isActive,
      createdAt: account.createdAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/user/social-accounts
 */
const getSocialAccounts = async (req, res, next) => {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { userId: req.user.id },
      select: {
        id: true, platform: true, accountName: true,
        accountId: true, isActive: true, createdAt: true,
        tokenExpiresAt: true,
      },
    });

    return response.success(res, accounts);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/user/social-accounts/:id
 */
const deleteSocialAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const account = await prisma.socialAccount.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!account) {
      return response.notFound(res, 'Social account not found');
    }

    await prisma.socialAccount.delete({ where: { id } });

    return response.success(res, { message: 'Social account removed' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/user/ai-keys
 */
const updateAiKeys = async (req, res, next) => {
  try {
    const { groqKey } = req.body;

    const data = {};
    if (groqKey !== undefined) data.groqKey = groqKey ? encrypt(groqKey) : null;

    const keys = await prisma.aiKey.upsert({
      where: { userId: req.user.id },
      update: data,
      create: { userId: req.user.id, ...data },
    });

    return response.success(res, {
      hasGroqKey: !!keys.groqKey,
      updatedAt: keys.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  updateProfile,
  getProfile,
  addSocialAccount,
  getSocialAccounts,
  deleteSocialAccount,
  updateAiKeys,
};
