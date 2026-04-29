const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { generateContent } = require('../controllers/contentController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

// POST /api/content/generate
router.post('/generate',
  [
    body('idea').isLength({ min: 1, max: 500 }).withMessage('Idea must be between 1 and 500 characters'),
    body('platforms').isArray({ min: 1 }),
    body('platforms.*').isIn(['TWITTER', 'LINKEDIN', 'INSTAGRAM', 'THREADS']),
    body('post_type').optional().isIn(['TEXT', 'IMAGE', 'CAROUSEL', 'THREAD', 'STORY']),
    body('tone').optional().isString(),
    body('language').optional().isString(),
    body('model').optional().isIn(['GPT4O', 'GPT4O_MINI', 'CLAUDE_3_5_SONNET', 'CLAUDE_3_HAIKU']),
  ],
  validate,
  generateContent
);

module.exports = router;
