const express = require('express');
const router = express.Router();

const { getStats } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/dashboard/stats
router.get('/stats', getStats);

module.exports = router;
