const mongoose = require('mongoose');

const syncErrorSchema = new mongoose.Schema(
  {
    syncJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SyncJob',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    entityType: { type: String, required: true },
    errorMessage: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SyncError', syncErrorSchema);
