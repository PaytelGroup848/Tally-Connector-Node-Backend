const { verifyConnectorAccessToken } = require('../services/token.service');
const Connector = require('../models/Connector');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');
const { resolveForConnector } = require('../services/permission.service');

const connectorAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Connector authentication required', ERROR_CODES.UNAUTHORIZED);
    }
    const payload = verifyConnectorAccessToken(header.slice(7));
    const connector = await Connector.findById(payload.connectorId);
    if (!connector) {
      throw new ApiError(401, 'Connector not found', ERROR_CODES.CONNECTOR_NOT_FOUND);
    }
    if (!connector.refreshTokenHash) {
      throw new ApiError(401, 'Connector session revoked', ERROR_CODES.AUTH_REVOKED);
    }

    const organizationId = connector.organizationId;
    const resolved = await resolveForConnector(organizationId);

    req.connector = connector;
    req.organizationId = organizationId;
    req.authContext = resolved;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = connectorAuth;
