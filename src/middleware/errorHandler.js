const logger = require('../utils/logger');
const response = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.name}: ${err.message}`, { stack: err.stack });

  // Prisma errors
  if (err.code === 'P2002') {
    return response.error(res, 'A record with that value already exists', 409);
  }
  if (err.code === 'P2025') {
    return response.notFound(res, 'Record not found');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return response.unauthorized(res, 'Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return response.unauthorized(res, 'Token expired');
  }

  // Default
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return response.error(res, message, statusCode);
};

module.exports = { errorHandler };
