const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    isVerified: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.index({ createdAt: -1 }, { background: true });

module.exports = mongoose.model("User", userSchema);
