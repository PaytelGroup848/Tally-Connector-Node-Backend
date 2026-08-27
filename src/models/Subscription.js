const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    at: { type: Date, default: Date.now },
    actorType: { type: String, enum: ['USER', 'SUPER_ADMIN', 'CONNECTOR', 'SYSTEM'] },
    actorId: { type: mongoose.Schema.Types.ObjectId },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    source: { type: String, enum: ['RAZORPAY', 'MANUAL'], required: true },
    status: { type: String, enum: ['ACTIVE', 'EXPIRED'], default: 'ACTIVE', index: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    extraSeats: { type: Number, default: 0, min: 0 },
    history: { type: [historySchema], default: [] },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
  },
  { timestamps: true }
);

subscriptionSchema.methods.isCurrentlyActive = function isCurrentlyActive() {
  return this.status === 'ACTIVE' && this.toDate >= new Date();
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
