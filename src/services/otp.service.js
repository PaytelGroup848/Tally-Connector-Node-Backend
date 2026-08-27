const crypto = require('crypto');
const OtpToken = require('../models/OtpToken');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');

const hashOtp = (email, otp, context) => {
  const secret = process.env.JWT_WEB_SECRET || 'otp-pepper';
  return crypto.createHmac('sha256', secret).update(`${email}:${context}:${otp}`).digest('hex');
};

const generateOtp = () => String(crypto.randomInt(1000, 10000));

const createAndStoreOtp = async (email, context) => {
  const normalized = email.toLowerCase().trim();
  const cooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
  const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 5);

  const existing = await OtpToken.findOne({ email: normalized, context }).sort({ createdAt: -1 });
  if (existing) {
    const elapsedMs = Date.now() - existing.createdAt.getTime();
    if (elapsedMs < cooldownSeconds * 1000) {
      const retryAfter = Math.ceil((cooldownSeconds * 1000 - elapsedMs) / 1000);
      throw new ApiError(
        429,
        `Please wait ${retryAfter}s before requesting another OTP`,
        ERROR_CODES.OTP_COOLDOWN
      );
    }
  }

  const otp = generateOtp();
  const otpHash = hashOtp(normalized, otp, context);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await OtpToken.deleteMany({ email: normalized, context });
  await OtpToken.create({
    email: normalized,
    otpHash,
    context,
    expiresAt,
    attempts: 0,
  });

  return { otp, expiresAt, expiryMinutes };
};

const verifyOtp = async (email, otp, context) => {
  const normalized = email.toLowerCase().trim();
  const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  const token = await OtpToken.findOne({ email: normalized, context }).sort({ createdAt: -1 });

  if (!token) {
    throw new ApiError(400, 'OTP not found. Request a new one.', ERROR_CODES.OTP_INVALID);
  }
  if (token.expiresAt < new Date()) {
    await OtpToken.deleteOne({ _id: token._id });
    throw new ApiError(400, 'OTP has expired', ERROR_CODES.OTP_EXPIRED);
  }
  if (token.attempts >= maxAttempts) {
    await OtpToken.deleteOne({ _id: token._id });
    throw new ApiError(400, 'Too many invalid OTP attempts', ERROR_CODES.OTP_MAX_ATTEMPTS);
  }

  const incomingHash = hashOtp(normalized, String(otp).trim(), context);
  if (incomingHash !== token.otpHash) {
    token.attempts += 1;
    await token.save();
    throw new ApiError(400, 'Invalid OTP', ERROR_CODES.OTP_INVALID);
  }

  await OtpToken.deleteOne({ _id: token._id });
  return true;
};

module.exports = { createAndStoreOtp, verifyOtp, generateOtp };
