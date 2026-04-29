const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { updateProfile, getProfile, addSocialAccount, getSocialAccounts, deleteSocialAccount, updateAiKeys } = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

// PUT /api/user/profile
router.put('/profile',
  [
    body('name').optional().trim().isLength({ max: 100 }),
    body('bio').optional().trim().isLength({ max: 500 }),
    body('avatarUrl').optional().isURL(),
  ],
  validate,
  updateProfile
);

// GET /api/user/profile
router.get('/profile', getProfile);

// POST /api/user/social-accounts
router.post('/social-accounts',
  [
    body('platform').isIn(['TWITTER', 'LINKEDIN', 'INSTAGRAM', 'THREADS']),
    body('accountId').notEmpty(),
    body('accountName').notEmpty(),
    body('accessToken').notEmpty(),
  ],
  validate,
  addSocialAccount
);

// GET /api/user/social-accounts
router.get('/social-accounts', getSocialAccounts);

// DELETE /api/user/social-accounts/:id
router.delete('/social-accounts/:id', deleteSocialAccount);

// PUT /api/user/ai-keys
router.put('/ai-keys', updateAiKeys);

module.exports = router;
