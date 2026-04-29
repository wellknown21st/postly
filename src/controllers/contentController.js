const aiEngine = require('../services/aiEngine');
const response = require('../utils/response');
const prisma = require('../config/database');
const { decrypt } = require('../utils/encryption');

/**
 * POST /api/content/generate
 */
const generateContent = async (req, res, next) => {
  try {
    const { idea, post_type, platforms, tone, language, model } = req.body;

    // Fetch user's API keys if available
    const aiKeys = await prisma.aiKey.findUnique({ where: { userId: req.user.id } });

    const userKeys = {};
    if (aiKeys?.groqKey) userKeys.groq = decrypt(aiKeys.groqKey);

    const result = await aiEngine.generate({
      idea,
      postType: post_type,
      platforms,
      tone: tone || 'professional',
      language: language || 'en',
      model: model || 'GROQ_LLAMA_3',
      userKeys,
    });

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = { generateContent };
