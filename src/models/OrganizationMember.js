const mongoose = require('mongoose');
const { ROLE } = require('../constants/permissions');

const organizationMemberSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: Object.values(ROLE),
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INVITED', 'REMOVED'],
      default: 'ACTIVE',
      index: true,
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('OrganizationMember', organizationMemberSchema);
