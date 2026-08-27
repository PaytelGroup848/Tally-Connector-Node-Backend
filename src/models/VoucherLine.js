const mongoose = require('mongoose');

const voucherLineSchema = new mongoose.Schema(
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
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
      required: true,
      index: true,
    },
    tallyExternalId: { type: String, required: true, trim: true },
    ledgerName: { type: String, default: '' },
    ledgerTallyExternalId: { type: String, default: '' },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    itemName: { type: String, default: '' },
    itemTallyExternalId: { type: String, default: '' },
    qty: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

voucherLineSchema.index(
  { organizationId: 1, companyId: 1, tallyExternalId: 1 },
  { unique: true }
);

module.exports = mongoose.model('VoucherLine', voucherLineSchema);
