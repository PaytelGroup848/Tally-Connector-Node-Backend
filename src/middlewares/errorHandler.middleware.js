const { ERROR_CODES } = require("../constants/permissions");

const errorHandler = (err, req, res, next) => {
  console.log("this is my error", err);
  const statusCode = err.statusCode || 500;
  const payload = {
    success: false,
    statusCode,
    message: err.message || "Internal server error",
    code:
      err.code ||
      (statusCode === 500 ? "INTERNAL_ERROR" : ERROR_CODES.FORBIDDEN),
    data: null,
  };
  if (err.errors) payload.errors = err.errors;
  if (process.env.NODE_ENV !== "production" && statusCode === 500) {
    payload.stack = err.stack;
  }
  res.status(statusCode).json(payload);
};

module.exports = errorHandler;
