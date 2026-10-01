const mongoose = require("mongoose");

const ewayBillSchema = new mongoose.Schema(
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
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voucher",
      required: true,
      index: true,
    },
    ewbNumber: { type: String, index: true },
    ewbDate: { type: Date },
    validUpto: { type: Date },
    vehicleNumber: { type: String, default: "" },
    transporterName: { type: String, default: "" },
    transporterId: { type: String, default: "" },
    transportMode: { type: String, default: "" },
    distanceKm: { type: Number, default: 0 },
    qrCodeSignedData: { type: String, default: "" },
    qrCodeImageBase64: { type: String, default: "" },
    status: {
      type: String,
      enum: ["GENERATED", "CANCELLED", "FAILED"],
      default: "FAILED",
      index: true,
    },
    errorMessage: { type: String, default: "" },
    tallySyncStatus: {
      type: String,
      enum: ["PENDING", "SYNCED", "FAILED"],
      default: "PENDING",
    },
    tallySyncCommandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Command",
      default: null,
    },
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

ewayBillSchema.index(
  { organizationId: 1, companyId: 1, status: 1, createdAt: -1 },
  { background: true },
);

module.exports = mongoose.model("EwayBill", ewayBillSchema);
