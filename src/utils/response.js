/**
 * Standard API response helpers
 * All responses follow the format: { data, meta, error }
 */

const success = (res, data, meta = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
    error: null,
  });
};

const created = (res, data, meta = {}) => {
  return success(res, data, meta, 201);
};

const paginated = (res, data, { page, limit, total }) => {
  return success(res, data, {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  });
};

const error = (res, message, statusCode = 400, details = null) => {
  return res.status(statusCode).json({
    data: null,
    meta: { timestamp: new Date().toISOString() },
    error: {
      message,
      ...(details && { details }),
    },
  });
};

const unauthorized = (res, message = 'Unauthorized') => {
  return error(res, message, 401);
};

const forbidden = (res, message = 'Forbidden') => {
  return error(res, message, 403);
};

const notFound = (res, message = 'Resource not found') => {
  return error(res, message, 404);
};

const serverError = (res, message = 'Internal server error') => {
  return error(res, message, 500);
};

module.exports = {
  success,
  created,
  paginated,
  error,
  unauthorized,
  forbidden,
  notFound,
  serverError,
};
