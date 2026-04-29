const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const prisma = require('../config/database');
const { getRedis } = require('../config/redis');
const aiEngine = require('../services/aiEngine');
const { publishQueue } = require('../queues/publishQueue');

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

// User state in Redis (expires in 30 mins)
const STATE_PREFIX = 'tg_state:';
const STATE_EXPIRY = 30 * 60;

const getBot = () => {
  if (!bot && token) {
    bot = new TelegramBot(token, { polling: false });

    // ✅ ADD THIS LINE
    registerHandlers(bot);
  }
  return bot;
};
const setupTelegramBot = async (app) => {
  if (!token) return;
  bot = getBot();
  const url = process.env.TELEGRAM_WEBHOOK_URL;
  if (url) {
    await bot.setWebHook(url);
    logger.info(`Telegram webhook set to ${url}`);
  }
};

const startPolling = () => {
  if (!token) return;
  bot = new TelegramBot(token, { polling: true });
  registerHandlers(bot);
};

// State Management
const setUserState = async (chatId, state) => {
  const redis = getRedis();
  await redis.setex(`${STATE_PREFIX}${chatId}`, STATE_EXPIRY, JSON.stringify(state));
};

const getUserState = async (chatId) => {
  const redis = getRedis();
  const data = await redis.get(`${STATE_PREFIX}${chatId}`);
  return data ? JSON.parse(data) : null;
};

const clearUserState = async (chatId) => {
  const redis = getRedis();
  await redis.del(`${STATE_PREFIX}${chatId}`);
};

const registerHandlers = (botInstance) => {
  botInstance.onText(/\/(start|help)/, async (msg) => {
    const chatId = msg.chat.id;
    await clearUserState(chatId);
    
    const helpText = `
Welcome to Postly Bot! 🚀
I can help you generate and publish AI content.

Commands:
/start or /help - Show this message
/post - Start a new post creation flow
/status - View your last 5 posts
/accounts - View connected platforms

Please use /post to get started!
    `;
    botInstance.sendMessage(chatId, helpText);
  });

  botInstance.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId.toString() } });
   if (!user) {
  await bot.sendMessage(chatId, "⚠️ Creating your account...");

  await prisma.user.create({
    data: {
      telegramId: chatId.toString(),
      name: "Telegram User"
    }
  });

  return bot.sendMessage(chatId, "✅ Account linked! Try again.");
}
    const posts = await prisma.post.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { platformPosts: { select: { platform: true, status: true } } }
    });

    if (posts.length === 0) return botInstance.sendMessage(chatId, "You haven't made any posts yet.");

    let message = "📊 Your recent posts:\n\n";
    posts.forEach((p, i) => {
      message += `${i+1}. [${p.status}] ${p.idea.substring(0, 30)}...\n`;
      p.platformPosts.forEach(pp => {
        message += `  - ${pp.platform}: ${pp.status}\n`;
      });
      message += '\n';
    });
    botInstance.sendMessage(chatId, message);
  });

  botInstance.onText(/\/accounts/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId.toString() } });
    if (!user) return botInstance.sendMessage(chatId, "Please link your account first via the web app.");

    const accounts = await prisma.socialAccount.findMany({ where: { userId: user.id, isActive: true } });
    
    if (accounts.length === 0) return botInstance.sendMessage(chatId, "No accounts linked. Link them in the web dashboard.");

    let message = "🔗 Linked Accounts:\n";
    accounts.forEach(a => {
      message += `- ${a.platform} (${a.accountName})\n`;
    });
    botInstance.sendMessage(chatId, message);
  });

  // Post creation flow
  botInstance.onText(/\/post/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId.toString() } });
    if (!user) return botInstance.sendMessage(chatId, "Please link your account first via the web app.");

    const accounts = await prisma.socialAccount.findMany({ where: { userId: user.id, isActive: true } });
    if (accounts.length === 0) return botInstance.sendMessage(chatId, "Please link at least one social account in the web app before posting.");

    const availablePlatforms = accounts.map(a => a.platform);

    await setUserState(chatId, { step: 'IDEA', platforms: availablePlatforms, userId: user.id });
    
    botInstance.sendMessage(chatId, "📝 Let's create a post! Please type your idea (max 500 chars):");
  });

  botInstance.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return; // Ignore commands

    const chatId = msg.chat.id;
    const state = await getUserState(chatId);
    if (!state) return;

    try {
      if (state.step === 'IDEA') {
        state.idea = msg.text.substring(0, 500);
        state.step = 'TONE';
        await setUserState(chatId, state);

        const opts = {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Professional', callback_data: 'tone_professional' }, { text: 'Casual', callback_data: 'tone_casual' }],
              [{ text: 'Humorous', callback_data: 'tone_humorous' }, { text: 'Inspirational', callback_data: 'tone_inspirational' }]
            ]
          }
        };
        botInstance.sendMessage(chatId, "Select a tone:", opts);
      }
    } catch (e) {
      logger.error('Telegram message error:', e);
      botInstance.sendMessage(chatId, "An error occurred. Please try /post again.");
    }
  });

  botInstance.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const state = await getUserState(chatId);

    if (!state) return;

    botInstance.answerCallbackQuery(query.id);

    try {
      if (data.startsWith('tone_') && state.step === 'TONE') {
        state.tone = data.split('_')[1];
        state.step = 'MODEL';
        await setUserState(chatId, state);

        const opts = {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Groq LLaMA 3', callback_data: 'model_GROQ_LLAMA_3' }]
            ]
          }
        };
        botInstance.sendMessage(chatId, "Select AI Model:", opts);
      } 
      else if (data.startsWith('model_') && state.step === 'MODEL') {
        state.model = data.replace('model_', '');
        state.step = 'GENERATING';
        await setUserState(chatId, state);

        botInstance.sendMessage(chatId, "⏳ Generating content...");

        // Call AI Engine
        const result = await aiEngine.generate({
          idea: state.idea,
          platforms: state.platforms,
          tone: state.tone,
          model: state.model
        });

        state.generatedContent = result.platforms;
        state.step = 'CONFIRM';
        await setUserState(chatId, state);

        let previewMsg = "✨ Content generated! Preview:\n\n";
        for (const [platform, content] of Object.entries(result.platforms)) {
          previewMsg += `*${platform}*:\n${typeof content === 'string' ? content : JSON.stringify(content)}\n\n`;
        }

        const opts = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Confirm & Publish', callback_data: 'action_publish' }],
              [{ text: '❌ Cancel', callback_data: 'action_cancel' }]
            ]
          },
          parse_mode: 'Markdown'
        };
        botInstance.sendMessage(chatId, previewMsg, opts);
      }
      else if (data === 'action_publish' && state.step === 'CONFIRM') {
        botInstance.sendMessage(chatId, "🚀 Queuing posts...");
        
        // 1. Create Post
        const post = await prisma.post.create({
          data: {
            userId: state.userId,
            idea: state.idea,
            postType: 'TEXT',
            tone: state.tone,
            aiModel: state.model,
            generatedContent: state.generatedContent,
            status: 'QUEUED'
          }
        });

        const accounts = await prisma.socialAccount.findMany({ 
          where: { userId: state.userId, platform: { in: state.platforms }, isActive: true } 
        });

        // 2. Create Platform Posts & enqueue
        for (const account of accounts) {
          const content = state.generatedContent[account.platform] || state.generatedContent[account.platform.toLowerCase()];
          if (!content) continue;

          const pp = await prisma.platformPost.create({
            data: {
              postId: post.id,
              socialAccountId: account.id,
              platform: account.platform,
              content: typeof content === 'string' ? content : content.content || JSON.stringify(content),
              status: 'QUEUED'
            }
          });

          const job = await publishQueue.add('publish-post', {
            platformPostId: pp.id,
            platform: account.platform,
            socialAccountId: account.id,
            postId: post.id,
            userId: state.userId
          }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 }});

          await prisma.platformPost.update({ where: { id: pp.id }, data: { jobId: job.id } });
        }

        await clearUserState(chatId);
        botInstance.sendMessage(chatId, "✅ Your posts have been queued! Use /status to check on them.");
      }
      else if (data === 'action_cancel') {
        await clearUserState(chatId);
        botInstance.sendMessage(chatId, "🚫 Post cancelled.");
      }
    } catch (e) {
      logger.error('Telegram flow error:', e);
      botInstance.sendMessage(chatId, `Error: ${e.message}`);
      await clearUserState(chatId);
    }
  });
};

const handleTelegramUpdate = async (update) => {
  const botInstance = getBot();
  if (botInstance) {
    botInstance.processUpdate(update);
  }
};

module.exports = { setupTelegramBot, startPolling, handleTelegramUpdate };
