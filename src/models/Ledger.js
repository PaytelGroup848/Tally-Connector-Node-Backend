const mongoose = require('mongoose');

const tenantFields = {
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
};

const ledgerSchema = new mongoose.Schema(
  {
    ...tenantFields,
    name: { type: String, required: true },
    parent: { type: String, default: '' },
    group: { type: String, default: '' },
    ledgerType: { type: String, default: '' },
    openingBalance: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 },
    gstin: { type: String, default: '' },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
ledgerSchema.index(
  { organizationId: 1, companyId: 1, tallyExternalId: 1 },
  { unique: true }
);
ledgerSchema.index(
  { organizationId: 1, companyId: 1, group: 1 },
  { background: true }
);
ledgerSchema.index(
  { organizationId: 1, companyId: 1, parent: 1 },
  { background: true }
);
ledgerSchema.index(
  { organizationId: 1, companyId: 1, name: 1 },
  { background: true }
);
ledgerSchema.index(
  { organizationId: 1, companyId: 1, ledgerType: 1, name: 1 },
  { background: true }
);

module.exports = mongoose.model('Ledger', ledgerSchema);
