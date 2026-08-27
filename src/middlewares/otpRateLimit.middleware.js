const rateLimit = require('express-rate-limit');

const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many OTP requests. Try again later.',
    code: 'OTP_RATE_LIMIT',
    data: null,
  },
});

module.exports = otpRateLimit;
