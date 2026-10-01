const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    tallyCompanyName: { type: String, required: true, trim: true },
    tallyCompanyGuid: { type: String, required: true, trim: true },
    linkedByConnectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connector' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companySchema.index({ organizationId: 1, tallyCompanyGuid: 1 }, { unique: true });
companySchema.index(
  { organizationId: 1, isActive: 1 },
  { background: true }
);

module.exports = mongoose.model('Company', companySchema);
