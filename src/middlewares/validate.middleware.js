const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');

const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(422, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, errors));
};

module.exports = validate;
