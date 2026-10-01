const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema(
  {
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
    type: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'DONE', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    errorMessage: { type: String, default: null },
    sentAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

commandSchema.index({ organizationId: 1, status: 1, createdAt: 1 });
commandSchema.index(
  { organizationId: 1, companyId: 1, type: 1, status: 1, createdAt: -1 },
  { background: true }
);

module.exports = mongoose.model('Command', commandSchema);
