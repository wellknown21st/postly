const response = require('../utils/response');

const notFound = (req, res) => {
  return response.notFound(res, `Route ${req.method} ${req.path} not found`);
};

module.exports = { notFound };
