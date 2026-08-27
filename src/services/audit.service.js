const AuditLog = require('../models/AuditLog');

const logAudit = async ({ organizationId, actorType, actorId, action, meta = {} }) => {
  return AuditLog.create({ organizationId, actorType, actorId, action, meta });
};

module.exports = { logAudit };
