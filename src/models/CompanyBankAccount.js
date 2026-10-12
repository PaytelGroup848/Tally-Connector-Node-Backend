const mongoose = require("mongoose");

const BANK_UNDER = ["Bank Accounts", "Bank OCC A/c", "Bank OD A/c"];

const companyBankAccountSchema = new mongoose.Schema(
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

    bankName: { type: String, required: true, trim: true, maxlength: 100 },
    under: { type: String, enum: BANK_UNDER, required: true },
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    accountNumber: { type: String, required: true, trim: true },
    ifscCode: { type: String, required: true, trim: true, uppercase: true },
    swiftCode: { type: String, default: "", trim: true, uppercase: true },
    branchName: { type: String, default: "", trim: true, maxlength: 100 },

 
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);


companyBankAccountSchema.index(
  { organizationId: 1, companyId: 1, accountNumber: 1, ifscCode: 1 },
  { unique: true },
);


companyBankAccountSchema.index({
  organizationId: 1,
  companyId: 1,
  isDefault: -1,
  createdAt: 1,
});


companyBankAccountSchema.index(
  { organizationId: 1, companyId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true },
    name: "one_default_bank_per_company",
  },
);

const CompanyBankAccount = mongoose.model(
  "CompanyBankAccount",
  companyBankAccountSchema,
);
CompanyBankAccount.BANK_UNDER = BANK_UNDER;

module.exports = CompanyBankAccount;
