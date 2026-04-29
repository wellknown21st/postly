const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const response = require('../utils/response');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return response.unauthorized(res, 'Token expired');
      }
      return response.unauthorized(res, 'Invalid token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, isActive: true },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        telegramChatId: true,
      },
    });

    if (!user) {
      return response.unauthorized(res, 'User not found or inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    return response.serverError(res, 'Authentication error');
  }
};

module.exports = { authenticate };
