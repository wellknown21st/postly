const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { handleTelegramUpdate } = require('../bot/telegram');

// POST /webhook/telegram
router.post('/telegram', async (req, res) => {
  try {
    // Basic secret token verification to ensure it's from Telegram
    // const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    // if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(403);
    
    const update = req.body;
    await handleTelegramUpdate(update);
    res.sendStatus(200);
  } catch (error) {
    logger.error('Telegram webhook error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;
