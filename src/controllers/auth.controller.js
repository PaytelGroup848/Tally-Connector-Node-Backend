const { body } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const { createAndStoreOtp, verifyOtp } = require('../services/otp.service');
const { sendOtpEmail } = require('../services/email.service');
const { signWebToken } = require('../services/token.service');
const { ensureUser, ensureOwnerOrg } = require('../services/org.service');
const { logAudit } = require('../services/audit.service');

const cookieName = () => process.env.WEB_JWT_COOKIE_NAME || 'lk_web_token';

const setWebCookie = (res, token) => {
  res.cookie(cookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const sendOtpValidators = [
  body('email').isEmail().withMessage('Valid email is required'),
];

const verifyOtpValidators = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits'),
];

const sendOtp = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  const { otp, expiryMinutes } = await createAndStoreOtp(email, 'WEB');
  await sendOtpEmail(email, otp, expiryMinutes, 'LiveKeeping');
  return send(res, 200, { email, expiresInMinutes: expiryMinutes }, 'OTP sent');
});

const verifyOtpHandler = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  await verifyOtp(email, req.body.otp, 'WEB');

  const user = await ensureUser(email);
  user.isVerified = true;
  const superEmail = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();
  if (superEmail && user.email === superEmail) {
    user.isSuperAdmin = true;
  }
  await user.save();

  let organization = null;
  let membership = null;
  if (!user.isSuperAdmin || req.body.createOrg !== false) {
    const result = await ensureOwnerOrg(user);
    organization = result.organization;
    membership = result.membership;
  }

  const token = signWebToken(user._id);
  setWebCookie(res, token);

  await logAudit({
    organizationId: organization?._id || null,
    actorType: user.isSuperAdmin ? 'SUPER_ADMIN' : 'USER',
    actorId: user._id,
    action: 'WEB_LOGIN',
    meta: { email: user.email },
  });

  return send(
    res,
    200,
    {
      token,
      user: {
        id: user._id,
        email: user.email,
        isVerified: user.isVerified,
        isSuperAdmin: user.isSuperAdmin,
      },
      organization: organization
        ? { id: organization._id, name: organization.name }
        : null,
      role: membership?.role || null,
    },
    'Logged in'
  );
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(cookieName());
  return send(res, 200, null, 'Logged out');
});

module.exports = {
  sendOtpValidators,
  verifyOtpValidators,
  sendOtp,
  verifyOtpHandler,
  logout,
};
