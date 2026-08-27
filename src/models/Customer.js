const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
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
    gstin: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    openingBalance: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

customerSchema.index(
  { organizationId: 1, companyId: 1, tallyExternalId: 1 },
  { unique: true }
);

module.exports = mongoose.model('Customer', customerSchema);
