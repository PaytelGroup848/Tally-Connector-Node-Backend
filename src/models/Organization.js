const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

organizationSchema.index({ createdAt: -1 }, { background: true });

module.exports = mongoose.model('Organization', organizationSchema);
