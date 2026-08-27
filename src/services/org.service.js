const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const { ROLE } = require('../constants/permissions');

const ensureUser = async (email) => {
  const normalized = email.toLowerCase().trim();
  let user = await User.findOne({ email: normalized });
  if (!user) {
    user = await User.create({ email: normalized, isVerified: false });
  }
  return user;
};

const ensureOwnerOrg = async (user, orgName) => {
  const existingMembership = await OrganizationMember.findOne({
    userId: user._id,
    status: { $in: ['ACTIVE', 'INVITED'] },
  }).sort({ createdAt: 1 });

  if (existingMembership) {
    const organization = await Organization.findById(existingMembership.organizationId);
    if (existingMembership.status === 'INVITED') {
      existingMembership.status = 'ACTIVE';
      await existingMembership.save();
    }
    return { organization, membership: existingMembership, created: false };
  }

  const organization = await Organization.create({
    name: orgName || `${user.email.split('@')[0]}'s organization`,
    ownerId: user._id,
  });
  const membership = await OrganizationMember.create({
    organizationId: organization._id,
    userId: user._id,
    role: ROLE.OWNER,
    status: 'ACTIVE',
  });
  return { organization, membership, created: true };
};

module.exports = { ensureUser, ensureOwnerOrg };
