require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { connectRedis } = require('./config/redis');
const { startWorkers } = require('./queues/workers');
const { setupTelegramBot } = require('./bot/telegram');

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // Connect to Redis
    await connectRedis();
    logger.info('✅ Redis connected');

    // Start BullMQ workers
    await startWorkers();
    logger.info('✅ Queue workers started');

    // Setup Telegram Bot (webhook mode)
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.NODE_ENV === 'production') {
      await setupTelegramBot(app);
      logger.info('✅ Telegram bot configured');
    } else if (process.env.TELEGRAM_BOT_TOKEN) {
      // In dev mode, use polling
      const { startPolling } = require('./bot/telegram');
      await startPolling();
      logger.info('✅ Telegram bot started (polling mode)');
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Postly server running on port ${PORT}`);
      logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
