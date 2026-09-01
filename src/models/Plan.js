const mongoose = require("mongoose");

const pricingOptionSchema = new mongoose.Schema(
  {
    durationMonths: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    addonPricePerSeat: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    features: [{ type: String }],
    seatLimit: { type: Number, required: true, min: 1, default: 1 },
    pricingOptions: { type: [pricingOptionSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Plan", planSchema);
