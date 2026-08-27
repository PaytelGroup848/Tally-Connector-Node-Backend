const mongoose = require('mongoose');

const connectorSessionSchema = new mongoose.Schema(
  {
    connectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Connector',
      required: true,
      index: true,
    },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ConnectorSession', connectorSessionSchema);
