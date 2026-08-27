const mongoose = require('mongoose');

const connectorSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    deviceId: { type: String, required: true, trim: true },
    deviceName: { type: String, default: '' },
    connectorVersion: { type: String, default: '' },
    status: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE', index: true },
    lastHeartbeatAt: { type: Date, default: null },
    tallyConnected: { type: Boolean, default: false },
    deviceInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
    refreshTokenHash: { type: String, default: null },
  },
  { timestamps: true }
);

connectorSchema.index({ organizationId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('Connector', connectorSchema);
