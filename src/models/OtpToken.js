const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    context: { type: String, enum: ['WEB', 'CONNECTOR', 'SUPER_ADMIN'], required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

otpTokenSchema.index({ email: 1, context: 1 });

module.exports = mongoose.model('OtpToken', otpTokenSchema);
