const mongoose = require('mongoose');

const stockBalanceSchema = new mongoose.Schema(
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
    itemName: { type: String, required: true },
    itemTallyExternalId: { type: String, default: '' },
    godown: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

stockBalanceSchema.index(
  { organizationId: 1, companyId: 1, tallyExternalId: 1 },
  { unique: true }
);

module.exports = mongoose.model('StockBalance', stockBalanceSchema);
