const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { register, login, refresh, logout, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// POST /api/auth/register
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    body('username').isAlphanumeric().isLength({ min: 3, max: 30 }),
    body('name').optional().trim().isLength({ max: 100 }),
  ],
  validate,
  register
);

// POST /api/auth/login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  login
);

// POST /api/auth/refresh
router.post('/refresh',
  [body('refreshToken').notEmpty()],
  validate,
  refresh
);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me
router.get('/me', authenticate, me);

module.exports = router;
