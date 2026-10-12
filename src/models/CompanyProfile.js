const mongoose = require("mongoose");

const companyProfileSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    address: { type: String, default: "", trim: true, maxlength: 500 },
    gstin: { type: String, default: "", trim: true },
    cin: { type: String, default: "", trim: true },
    pan: { type: String, default: "", trim: true },
    mobile: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    website: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    stateCode: { type: String, default: "", trim: true },
    termsAndConditions: { type: String, default: "", maxlength: 5000 },
    logoFileName: { type: String, default: "" },
  },
  { timestamps: true },
);

companyProfileSchema.index(
  { organizationId: 1, companyId: 1 },
  { unique: true },
);

module.exports = mongoose.model("CompanyProfile", companyProfileSchema);
