const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { handleTelegramUpdate } = require('../bot/telegram');

// POST /webhook/telegram
router.post('/telegram', async (req, res) => {
  console.log("🔥 webhook hit");
  console.log("Body:", req.body);

  try {
    await handleTelegramUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

module.exports = router;
