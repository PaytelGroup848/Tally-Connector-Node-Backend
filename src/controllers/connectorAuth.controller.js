const { body } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');
const { createAndStoreOtp, verifyOtp } = require('../services/otp.service');
const { sendOtpEmail } = require('../services/email.service');
const {
  signConnectorAccessToken,
  signConnectorRefreshToken,
  verifyConnectorRefreshToken,
  hashToken,
  parseExpiresInMs,
} = require('../services/token.service');
const { resolveForConnector } = require('../services/permission.service');
const { ensureUser, ensureOwnerOrg } = require('../services/org.service');
const Connector = require('../models/Connector');
const ConnectorSession = require('../models/ConnectorSession');
const { logAudit } = require('../services/audit.service');

const sendOtpValidators = [
  body('email').isEmail().withMessage('Valid email is required'),
];

const verifyOtpValidators = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits'),
  body('deviceId').isString().notEmpty().withMessage('deviceId is required'),
  body('deviceName').optional().isString(),
  body('connectorVersion').optional().isString(),
];

const refreshValidators = [
  body('refreshToken').isString().notEmpty().withMessage('refreshToken is required'),
];

const issueConnectorTokens = async (connector) => {
  const accessToken = signConnectorAccessToken({
    connectorId: connector._id,
    organizationId: connector.organizationId,
  });
  const refreshToken = signConnectorRefreshToken({ connectorId: connector._id });
  connector.refreshTokenHash = hashToken(refreshToken);
  await connector.save();

  const expiresAt = new Date(
    Date.now() + parseExpiresInMs(process.env.JWT_CONNECTOR_REFRESH_EXPIRES_IN)
  );
  await ConnectorSession.create({
    connectorId: connector._id,
    issuedAt: new Date(),
    expiresAt,
    revoked: false,
  });

  return { accessToken, refreshToken };
};

const serializeAuthPayload = async (connector) => {
  const resolved = await resolveForConnector(connector.organizationId);
  return {
    connector: {
      id: connector._id,
      organizationId: connector.organizationId,
      deviceId: connector.deviceId,
      deviceName: connector.deviceName,
      connectorVersion: connector.connectorVersion,
      status: connector.status,
    },
    plan: resolved.plan
      ? {
          id: resolved.plan._id,
          name: resolved.plan.name,
          features: resolved.plan.features,
          seatLimit: resolved.plan.seatLimit,
        }
      : null,
    permissions: resolved.permissions,
    subscription: resolved.subscription
      ? {
          status: resolved.subscription.status,
          fromDate: resolved.subscription.fromDate,
          toDate: resolved.subscription.toDate,
          extraSeats: resolved.subscription.extraSeats,
          active: resolved.subscriptionActive,
        }
      : null,
  };
};

const sendOtp = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  const { otp, expiryMinutes } = await createAndStoreOtp(email, 'CONNECTOR');
  await sendOtpEmail(email, otp, expiryMinutes, 'LiveKeeping Connector');
  return send(res, 200, { email, expiresInMinutes: expiryMinutes }, 'OTP sent');
});

const verifyOtpHandler = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  const { otp, deviceId, deviceName, connectorVersion } = req.body;
  await verifyOtp(email, otp, 'CONNECTOR');

  const user = await ensureUser(email);
  user.isVerified = true;
  await user.save();
  const { organization } = await ensureOwnerOrg(user);

  let connector = await Connector.findOne({
    organizationId: organization._id,
    deviceId,
  });
  if (!connector) {
    connector = await Connector.create({
      organizationId: organization._id,
      deviceId,
      deviceName: deviceName || '',
      connectorVersion: connectorVersion || '',
      status: 'ONLINE',
      lastHeartbeatAt: new Date(),
    });
  } else {
    connector.deviceName = deviceName || connector.deviceName;
    connector.connectorVersion = connectorVersion || connector.connectorVersion;
    connector.status = 'ONLINE';
    connector.lastHeartbeatAt = new Date();
    await connector.save();
  }

  const tokens = await issueConnectorTokens(connector);
  const body = await serializeAuthPayload(connector);

  await logAudit({
    organizationId: organization._id,
    actorType: 'CONNECTOR',
    actorId: connector._id,
    action: 'CONNECTOR_LOGIN',
    meta: { deviceId, email },
  });

  return send(res, 200, { ...body, ...tokens }, 'Connector authenticated');
});

const refresh = asyncHandler(async (req, res) => {
  const payload = verifyConnectorRefreshToken(req.body.refreshToken);
  const connector = await Connector.findById(payload.connectorId);
  if (!connector || !connector.refreshTokenHash) {
    throw new ApiError(401, 'Connector session revoked', ERROR_CODES.AUTH_REVOKED);
  }
  if (connector.refreshTokenHash !== hashToken(req.body.refreshToken)) {
    throw new ApiError(401, 'Refresh token mismatch', ERROR_CODES.AUTH_REVOKED);
  }

  const accessToken = signConnectorAccessToken({
    connectorId: connector._id,
    organizationId: connector.organizationId,
  });
  const body = await serializeAuthPayload(connector);
  return send(res, 200, { ...body, accessToken }, 'Token refreshed');
});

const logout = asyncHandler(async (req, res) => {
  const connector = req.connector;
  connector.refreshTokenHash = null;
  connector.status = 'OFFLINE';
  await connector.save();
  await ConnectorSession.updateMany({ connectorId: connector._id }, { revoked: true });
  await logAudit({
    organizationId: connector.organizationId,
    actorType: 'CONNECTOR',
    actorId: connector._id,
    action: 'CONNECTOR_LOGOUT',
    meta: {},
  });
  return send(res, 200, null, 'Connector logged out');
});

module.exports = {
  sendOtpValidators,
  verifyOtpValidators,
  refreshValidators,
  sendOtp,
  verifyOtpHandler,
  refresh,
  logout,
};
