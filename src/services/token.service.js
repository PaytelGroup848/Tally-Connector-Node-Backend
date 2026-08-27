const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');

const signWebToken = (userId) => {
  return jwt.sign({ userId: String(userId), typ: 'web' }, process.env.JWT_WEB_SECRET, {
    expiresIn: process.env.JWT_WEB_EXPIRES_IN || '7d',
  });
};

const verifyWebToken = (token) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_WEB_SECRET);
    if (payload.typ !== 'web') {
      throw new ApiError(401, 'Invalid token type', ERROR_CODES.UNAUTHORIZED);
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'Invalid or expired web token', ERROR_CODES.UNAUTHORIZED);
  }
};

const signConnectorAccessToken = ({ connectorId, organizationId }) => {
  return jwt.sign(
    {
      connectorId: String(connectorId),
      organizationId: String(organizationId),
      typ: 'connector',
    },
    process.env.JWT_CONNECTOR_ACCESS_SECRET,
    { expiresIn: process.env.JWT_CONNECTOR_ACCESS_EXPIRES_IN || '1h' }
  );
};

const verifyConnectorAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_CONNECTOR_ACCESS_SECRET);
    if (payload.typ !== 'connector') {
      throw new ApiError(401, 'Invalid token type', ERROR_CODES.UNAUTHORIZED);
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'Invalid or expired connector token', ERROR_CODES.UNAUTHORIZED);
  }
};

const signConnectorRefreshToken = ({ connectorId }) => {
  return jwt.sign(
    { connectorId: String(connectorId), typ: 'connector_refresh' },
    process.env.JWT_CONNECTOR_REFRESH_SECRET,
    { expiresIn: process.env.JWT_CONNECTOR_REFRESH_EXPIRES_IN || '90d' }
  );
};

const verifyConnectorRefreshToken = (token) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_CONNECTOR_REFRESH_SECRET);
    if (payload.typ !== 'connector_refresh') {
      throw new ApiError(401, 'Invalid token type', ERROR_CODES.UNAUTHORIZED);
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'Invalid or expired refresh token', ERROR_CODES.AUTH_REVOKED);
  }
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const parseExpiresInMs = (value) => {
  if (!value) return 90 * 24 * 60 * 60 * 1000;
  const match = String(value).match(/^(\d+)([smhd])$/);
  if (!match) return 90 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  const map = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return n * map[unit];
};

module.exports = {
  signWebToken,
  verifyWebToken,
  signConnectorAccessToken,
  verifyConnectorAccessToken,
  signConnectorRefreshToken,
  verifyConnectorRefreshToken,
  hashToken,
  parseExpiresInMs,
};
