const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const OrganizationMember = require('../models/OrganizationMember');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');

const getOrExpireSubscription = async (organizationId) => {
  const subscription = await Subscription.findOne({ organizationId });
  if (!subscription) return null;

  if (subscription.status === 'ACTIVE' && subscription.toDate < new Date()) {
    subscription.status = 'EXPIRED';
    subscription.history.push({
      action: 'EXPIRED',
      at: new Date(),
      actorType: 'SYSTEM',
      meta: { toDate: subscription.toDate },
    });
    await subscription.save();
  }
  return subscription;
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Number(months));
  return d;
};

const applySubscription = async ({
  organizationId,
  planId,
  source,
  fromDate,
  toDate,
  extraSeats = 0,
  razorpayOrderId = null,
  razorpayPaymentId = null,
  actorType,
  actorId,
  action = 'CREATED',
}) => {
  const existing = await Subscription.findOne({ organizationId });
  const historyEntry = {
    action: existing ? (action === 'CREATED' ? 'UPDATED' : action) : 'CREATED',
    at: new Date(),
    actorType,
    actorId,
    meta: {
      planId,
      fromDate,
      toDate,
      extraSeats,
      source,
    },
  };

  if (existing) {
    if (String(existing.planId) !== String(planId)) {
      historyEntry.action = 'PLAN_CHANGED';
      historyEntry.meta.previousPlanId = existing.planId;
    }
    existing.planId = planId;
    existing.source = source;
    existing.status = toDate >= new Date() ? 'ACTIVE' : 'EXPIRED';
    existing.fromDate = fromDate;
    existing.toDate = toDate;
    existing.extraSeats = extraSeats;
    if (source === 'RAZORPAY') {
      existing.razorpayOrderId = razorpayOrderId;
      existing.razorpayPaymentId = razorpayPaymentId;
    }
    existing.history.push(historyEntry);
    await existing.save();
    await AuditLog.create({
      organizationId,
      actorType,
      actorId,
      action: `SUBSCRIPTION_${historyEntry.action}`,
      meta: historyEntry.meta,
    });
    return existing;
  }

  const created = await Subscription.create({
    organizationId,
    planId,
    source,
    status: toDate >= new Date() ? 'ACTIVE' : 'EXPIRED',
    fromDate,
    toDate,
    extraSeats,
    razorpayOrderId: source === 'RAZORPAY' ? razorpayOrderId : null,
    razorpayPaymentId: source === 'RAZORPAY' ? razorpayPaymentId : null,
    history: [historyEntry],
  });

  await AuditLog.create({
    organizationId,
    actorType,
    actorId,
    action: 'SUBSCRIPTION_CREATED',
    meta: historyEntry.meta,
  });
  return created;
};

const assertSeatAvailable = async (organizationId) => {
  const subscription = await getOrExpireSubscription(organizationId);
  if (!subscription || !subscription.isCurrentlyActive()) {
    throw new ApiError(402, 'Active subscription required', ERROR_CODES.SUBSCRIPTION_EXPIRED);
  }
  const plan = await Plan.findById(subscription.planId);
  const limit = (plan?.seatLimit || 1) + (subscription.extraSeats || 0);
  const used = await OrganizationMember.countDocuments({
    organizationId,
    status: { $in: ['ACTIVE', 'INVITED'] },
  });
  if (used >= limit) {
    throw new ApiError(403, 'Seat limit reached', ERROR_CODES.SEAT_LIMIT_REACHED);
  }
  return { limit, used, remaining: limit - used };
};

module.exports = {
  getOrExpireSubscription,
  addMonths,
  applySubscription,
  assertSeatAvailable,
};
