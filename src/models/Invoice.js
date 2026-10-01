const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    service: { type: String, default: "Software" },
    quantity: { type: Number, default: 1 },
    rate: { type: Number, default: 0 },
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
      index: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    invoiceDate: {
      type: Date,
      default: Date.now,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["PAID", "CANCELLED"],
      default: "PAID",
    },

    currency: {
      type: String,
      default: "INR",
    },

    subtotal: {
      type: Number,
      required: true,
    },

    gstPercent: {
      type: Number,
      default: 18,
    },

    gstAmount: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    razorpayOrderId: {
      type: String,
      required: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    plan: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Plan",
      },
      name: {
        type: String,
        default: "",
      },
      durationMonths: {
        type: Number,
        default: 1,
      },
      extraSeats: {
        type: Number,
        default: 0,
      },
    },

    billingTo: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      gstin: { type: String, default: "" },
    },

    seller: {
      name: { type: String, default: "CtrlBook" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      gstin: { type: String, default: "" },
    },

    items: {
      type: [invoiceItemSchema],
      default: [],
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

invoiceSchema.index(
  { organizationId: 1, invoiceDate: -1 },
  { background: true },
);

module.exports = mongoose.model("Invoice", invoiceSchema);
