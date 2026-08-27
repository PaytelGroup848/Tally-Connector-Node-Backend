const mongoose = require('mongoose');

const syncJobSchema = new mongoose.Schema(
  {
    connectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Connector',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    type: { type: String, enum: ['INITIAL', 'INCREMENTAL'], required: true },
    status: {
      type: String,
      enum: ['RUNNING', 'COMPLETED', 'FAILED'],
      default: 'RUNNING',
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    stats: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SyncJob', syncJobSchema);
