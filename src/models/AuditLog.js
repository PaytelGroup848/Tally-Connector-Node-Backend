const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    actorType: {
      type: String,
      enum: ['USER', 'SUPER_ADMIN', 'CONNECTOR', 'SYSTEM'],
      required: true,
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    action: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index(
  { organizationId: 1, createdAt: -1 },
  { background: true }
);
auditLogSchema.index(
  { organizationId: 1, action: 1, createdAt: -1 },
  { background: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
