const { body } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');
const Company = require('../models/Company');
const Connector = require('../models/Connector');
const SyncJob = require('../models/SyncJob');
const { resolveForConnector } = require('../services/permission.service');
const { logAudit } = require('../services/audit.service');

const OFFLINE_AFTER_MS = 2 * 60 * 1000;

const maybeMarkOffline = (connector) => {
  if (
    connector.status === 'ONLINE' &&
    connector.lastHeartbeatAt &&
    Date.now() - connector.lastHeartbeatAt.getTime() > OFFLINE_AFTER_MS
  ) {
    connector.status = 'OFFLINE';
  }
  return connector;
};

const me = asyncHandler(async (req, res) => {
  const connector = maybeMarkOffline(req.connector);
  await connector.save();
  const resolved = await resolveForConnector(req.organizationId);
  if (!resolved.subscriptionActive) {
    throw new ApiError(402, 'Subscription has expired', ERROR_CODES.SUBSCRIPTION_EXPIRED);
  }
  return send(
    res,
    200,
    {
      connector: {
        id: connector._id,
        organizationId: connector.organizationId,
        deviceId: connector.deviceId,
        deviceName: connector.deviceName,
        connectorVersion: connector.connectorVersion,
        status: connector.status,
        lastHeartbeatAt: connector.lastHeartbeatAt,
        tallyConnected: connector.tallyConnected,
      },
      plan: resolved.plan
        ? { id: resolved.plan._id, name: resolved.plan.name, features: resolved.plan.features }
        : null,
      permissions: resolved.permissions,
      subscription: {
        status: resolved.subscription.status,
        fromDate: resolved.subscription.fromDate,
        toDate: resolved.subscription.toDate,
        active: resolved.subscriptionActive,
      },
    },
    'Connector identity'
  );
});

const listCompanies = asyncHandler(async (req, res) => {
  const companies = await Company.find({ organizationId: req.organizationId, isActive: true }).lean();
  return send(
    res,
    200,
    {
      companies: companies.map((c) => ({
        id: c._id,
        tallyCompanyName: c.tallyCompanyName,
        tallyCompanyGuid: c.tallyCompanyGuid,
      })),
    },
    'Companies'
  );
});

const linkValidators = [
  body('tallyCompanyName').isString().notEmpty(),
  body('tallyCompanyGuid').isString().notEmpty(),
];

const linkCompany = asyncHandler(async (req, res) => {
  const { tallyCompanyName, tallyCompanyGuid } = req.body;
  let company = await Company.findOne({
    organizationId: req.organizationId,
    tallyCompanyGuid,
  });
  if (!company) {
    company = await Company.create({
      organizationId: req.organizationId,
      tallyCompanyName,
      tallyCompanyGuid,
      linkedByConnectorId: req.connector._id,
    });
    await logAudit({
      organizationId: req.organizationId,
      actorType: 'CONNECTOR',
      actorId: req.connector._id,
      action: 'COMPANY_LINKED',
      meta: { tallyCompanyGuid, tallyCompanyName },
    });
  } else {
    company.tallyCompanyName = tallyCompanyName;
    company.linkedByConnectorId = req.connector._id;
    company.isActive = true;
    await company.save();
  }
  return send(
    res,
    200,
    {
      company: {
        id: company._id,
        tallyCompanyName: company.tallyCompanyName,
        tallyCompanyGuid: company.tallyCompanyGuid,
      },
    },
    'Company linked'
  );
});

const heartbeatValidators = [
  body('tallyConnected').isBoolean(),
  body('deviceInfo').optional(),
];

const heartbeat = asyncHandler(async (req, res) => {
  const connector = req.connector;
  connector.status = 'ONLINE';
  connector.lastHeartbeatAt = new Date();
  connector.tallyConnected = Boolean(req.body.tallyConnected);
  if (req.body.deviceInfo) connector.deviceInfo = req.body.deviceInfo;
  if (req.body.connectorVersion) connector.connectorVersion = req.body.connectorVersion;
  await connector.save();
  return send(
    res,
    200,
    {
      status: connector.status,
      lastHeartbeatAt: connector.lastHeartbeatAt,
      tallyConnected: connector.tallyConnected,
    },
    'Heartbeat recorded'
  );
});

const config = asyncHandler(async (req, res) => {
  const resolved = await resolveForConnector(req.organizationId);
  return send(
    res,
    200,
    {
      syncIntervalSeconds: Number(process.env.CONNECTOR_SYNC_INTERVAL_SECONDS || 300),
      features: resolved.permissions,
      flags: {
        incrementalSync: true,
        commandPolling: true,
      },
    },
    'Config'
  );
});

const version = asyncHandler(async (req, res) => {
  return send(
    res,
    200,
    {
      latestVersion: process.env.CONNECTOR_LATEST_VERSION || '1.0.0',
      downloadUrl: process.env.CONNECTOR_DOWNLOAD_URL || null,
    },
    'Version'
  );
});

const webStatus = asyncHandler(async (req, res) => {
  const connectors = await Connector.find({ organizationId: req.organizationId });
  const lastJob = await SyncJob.findOne({ organizationId: req.organizationId })
    .sort({
    startedAt: -1,
  })
    .lean();
  const mapped = connectors.map((c) => {
    maybeMarkOffline(c);
    return {
      id: c._id,
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      status: c.status,
      lastHeartbeatAt: c.lastHeartbeatAt,
      tallyConnected: c.tallyConnected,
      connectorVersion: c.connectorVersion,
    };
  });
  await Promise.all(connectors.map((c) => c.save()));
  return send(
    res,
    200,
    {
      connectors: mapped,
      lastSync: lastJob
        ? {
            id: lastJob._id,
            type: lastJob.type,
            status: lastJob.status,
            startedAt: lastJob.startedAt,
            completedAt: lastJob.completedAt,
            companyId: lastJob.companyId,
          }
        : null,
    },
    'Connector status'
  );
});

module.exports = {
  me,
  listCompanies,
  linkCompany,
  linkValidators,
  heartbeat,
  heartbeatValidators,
  config,
  version,
  webStatus,
};
