const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema(
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
    voucherType: { type: String, default: '' },
    voucherNumber: { type: String, default: '' },
    date: { type: Date },
    partyLedger: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    narration: { type: String, default: '' },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

voucherSchema.index({ organizationId: 1, companyId: 1, tallyExternalId: 1 }, { unique: true });
voucherSchema.index({ organizationId: 1, companyId: 1, date: -1 });
voucherSchema.index(
  { organizationId: 1, companyId: 1, voucherType: 1, partyLedger: 1 },
  { background: true }
);
voucherSchema.index(
  { organizationId: 1, companyId: 1, voucherType: 1, date: -1 },
  { background: true }
);
voucherSchema.index(
  { organizationId: 1, companyId: 1, voucherType: 1, partyLedger: 1 },
  { background: true }
);
voucherSchema.index(
  { organizationId: 1, companyId: 1, voucherType: 1, date: -1 },
  { background: true }
);

module.exports = mongoose.model('Voucher', voucherSchema);
