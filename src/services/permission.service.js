const OrganizationMember = require('../models/OrganizationMember');
const Plan = require('../models/Plan');
const { ROLE_PERMISSIONS, ALL_PERMISSIONS } = require('../constants/permissions');
const { getOrExpireSubscription } = require('./subscription.service');

const intersect = (a, b) => a.filter((item) => b.includes(item));

const resolveForMember = async (userId, organizationId) => {
  const member = await OrganizationMember.findOne({
    userId,
    organizationId,
    status: { $in: ['ACTIVE', 'INVITED'] },
  });

  const subscription = await getOrExpireSubscription(organizationId);
  const plan = subscription ? await Plan.findById(subscription.planId) : null;
  const planFeatures = plan?.features?.length ? plan.features : [];
  const rolePermissions = member ? ROLE_PERMISSIONS[member.role] || [] : [];
  const permissions = intersect(rolePermissions, planFeatures);

  return {
    member,
    role: member?.role || null,
    subscription,
    plan,
    permissions,
    subscriptionActive: Boolean(subscription && subscription.isCurrentlyActive()),
  };
};

const resolveForConnector = async (organizationId) => {
  const subscription = await getOrExpireSubscription(organizationId);
  const plan = subscription ? await Plan.findById(subscription.planId) : null;
  const planFeatures = plan?.features?.length ? plan.features : [];
  const permissions = intersect(ALL_PERMISSIONS, planFeatures);

  return {
    subscription,
    plan,
    permissions,
    subscriptionActive: Boolean(subscription && subscription.isCurrentlyActive()),
  };
};

module.exports = { resolveForMember, resolveForConnector, intersect };
