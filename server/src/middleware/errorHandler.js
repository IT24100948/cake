const ApiError = require('../utils/ApiError');
const { removeUpload, publicUrl } = require('./upload');
const { isTest } = require('../config/env');

function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Discard an uploaded file if the request failed.
  if (req.file) removeUpload(publicUrl(req.file));

  if (err.type === 'entity.parse.failed') err = ApiError.badRequest('Malformed JSON body');
  if (err.code === 'ER_DUP_ENTRY') err = ApiError.conflict('A record with the same unique value already exists');
  if (err.code === 'ER_ROW_IS_REFERENCED_2') err = ApiError.conflict('This record is in use and cannot be deleted');

  const status = err.status || 500;
  if (status >= 500 && !isTest) console.error(err);
  const body = { message: status >= 500 ? 'Something went wrong. Please try again.' : err.message };
  if (err.errors) body.errors = err.errors;
  if (err.code && typeof err.code === 'string' && status < 500) body.code = err.code;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
