class ApiError extends Error {
  constructor(statusCode, message, code = null, errors = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.success = false;
  }
}

module.exports = ApiError;
