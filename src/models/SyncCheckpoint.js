const mongoose = require('mongoose');

const syncCheckpointSchema = new mongoose.Schema(
  {
    connectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Connector',
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    entityType: { type: String, required: true },
    lastSyncedAt: { type: Date, default: null },
    lastSyncedExternalId: { type: String, default: null },
  },
  { timestamps: true }
);

syncCheckpointSchema.index(
  { connectorId: 1, companyId: 1, entityType: 1 },
  { unique: true }
);

module.exports = mongoose.model('SyncCheckpoint', syncCheckpointSchema);
