const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return next(new ApiError(
    400,
    'Request validation failed',
    'VALIDATION_ERROR',
    errors.array().map(({ path, msg, value }) => ({ field: path, message: msg, value })),
  ));
}

module.exports = validate;
