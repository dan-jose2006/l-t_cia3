const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

function normalizeError(error) {
  if (error instanceof ApiError) return error;

  if (error.name === 'CastError') {
    return new ApiError(404, 'Requested record was not found', 'NOT_FOUND');
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'value';
    return new ApiError(409, `A record with this ${field} already exists`, 'DUPLICATE_RECORD');
  }

  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }));
    return new ApiError(400, 'Database validation failed', 'VALIDATION_ERROR', details);
  }

  return new ApiError(500, 'An unexpected server error occurred', 'INTERNAL_SERVER_ERROR');
}

function errorHandler(error, req, res, next) {
  const normalized = normalizeError(error);
  if (normalized.statusCode >= 500 && process.env.NODE_ENV !== 'test') console.error(error);

  const response = {
    success: false,
    message: normalized.message,
    errorCode: normalized.errorCode,
  };
  if (normalized.details) response.details = normalized.details;
  if (process.env.NODE_ENV === 'development' && normalized.statusCode >= 500) response.stack = error.stack;

  res.status(normalized.statusCode).json(response);
}

module.exports = { notFound, errorHandler };
