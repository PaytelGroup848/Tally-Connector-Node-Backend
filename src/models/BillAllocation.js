const mongoose = require("mongoose");

const billAllocationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    tallyExternalId: { type: String, required: true, trim: true },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
      required: true,
      index: true,
    },
    voucherType: { type: String, default: "" },
    voucherDate: { type: Date },
    partyLedger: { type: String, required: true, index: true },
    billName: { type: String, required: true },
    billType: {
      type: String,
      enum: ["New Ref", "Against Ref", "Advance", "On Account"],
      default: "New Ref",
    },

    amount: { type: Number, default: 0 },
    dueDate: { type: Date },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

billAllocationSchema.index(
  { organizationId: 1, companyId: 1, tallyExternalId: 1 },
  { unique: true },
);
billAllocationSchema.index({
  organizationId: 1,
  companyId: 1,
  partyLedger: 1,
  billName: 1,
});

module.exports = mongoose.model("BillAllocation", billAllocationSchema);
