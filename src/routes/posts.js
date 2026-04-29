const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const { publish, schedule, getPosts, getPost, retryPost, deletePost } = require('../controllers/postsController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

// POST /api/posts/publish
router.post('/publish',
  [
    body('idea').notEmpty(),
    body('platforms').isArray({ min: 1 }),
  ],
  validate,
  publish
);

// POST /api/posts/schedule
router.post('/schedule',
  [
    body('idea').notEmpty(),
    body('platforms').isArray({ min: 1 }),
    body('scheduled_at').isISO8601(),
  ],
  validate,
  schedule
);

// GET /api/posts
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['DRAFT', 'QUEUED', 'PUBLISHING', 'PUBLISHED', 'SCHEDULED', 'FAILED', 'PARTIAL']),
    query('platform').optional().isIn(['TWITTER', 'LINKEDIN', 'INSTAGRAM', 'THREADS']),
  ],
  validate,
  getPosts
);

// GET /api/posts/:id
router.get('/:id', getPost);

// POST /api/posts/:id/retry
router.post('/:id/retry', retryPost);

// DELETE /api/posts/:id
router.delete('/:id', deletePost);

module.exports = router;
