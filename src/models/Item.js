const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
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
    tallyExternalId: { type: String, required: true, trim: true },
    name: { type: String, required: true },
    unit: { type: String, default: '' },
    hsn: { type: String, default: '' },
    rate: { type: Number, default: 0 },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

itemSchema.index({ organizationId: 1, companyId: 1, tallyExternalId: 1 }, { unique: true });

module.exports = mongoose.model('Item', itemSchema);
