const { body, param } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');
const { createAndStoreOtp, verifyOtp } = require('../services/otp.service');
const { sendOtpEmail } = require('../services/email.service');
const { signWebToken } = require('../services/token.service');
const { ensureUser, ensureOwnerOrg } = require('../services/org.service');
const { applySubscription } = require('../services/subscription.service');
const { logAudit } = require('../services/audit.service');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Connector = require('../models/Connector');
const AuditLog = require('../models/AuditLog');

const assertSuperAdminEmail = (email) => {
  const configured = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();
  if (!configured || email !== configured) {
    throw new ApiError(403, 'Not authorized for super admin OTP', ERROR_CODES.FORBIDDEN);
  }
};

const sendOtpValidators = [body('email').isEmail()];
const verifyOtpValidators = [
  body('email').isEmail(),
  body('otp').isLength({ min: 4, max: 4 }),
];

const sendOtp = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  assertSuperAdminEmail(email);
  const { otp, expiryMinutes } = await createAndStoreOtp(email, 'SUPER_ADMIN');
  await sendOtpEmail(email, otp, expiryMinutes, 'LiveKeeping Super Admin');
  return send(res, 200, { email, expiresInMinutes: expiryMinutes }, 'OTP sent');
});

const verifyOtpHandler = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  assertSuperAdminEmail(email);
  await verifyOtp(email, req.body.otp, 'SUPER_ADMIN');
  const user = await ensureUser(email);
  user.isVerified = true;
  user.isSuperAdmin = true;
  await user.save();
  const token = signWebToken(user._id);
  const cookieName = process.env.WEB_JWT_COOKIE_NAME || 'lk_web_token';
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return send(
    res,
    200,
    {
      token,
      user: { id: user._id, email: user.email, isSuperAdmin: true },
    },
    'Super admin logged in'
  );
});

const listOrganizations = asyncHandler(async (req, res) => {
  const orgs = await Organization.find().sort({ createdAt: -1 });
  const ids = orgs.map((o) => o._id);
  const subs = await Subscription.find({ organizationId: { $in: ids } });
  const subByOrg = Object.fromEntries(subs.map((s) => [String(s.organizationId), s]));
  return send(
    res,
    200,
    {
      organizations: orgs.map((o) => {
        const sub = subByOrg[String(o._id)];
        return {
          id: o._id,
          name: o.name,
          ownerId: o.ownerId,
          createdAt: o.createdAt,
          subscription: sub
            ? {
                id: sub._id,
                status: sub.status,
                fromDate: sub.fromDate,
                toDate: sub.toDate,
                extraSeats: sub.extraSeats,
                source: sub.source,
              }
            : null,
        };
      }),
    },
    'Organizations'
  );
});

const getOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.params.id);
  if (!organization) throw new ApiError(404, 'Organization not found', ERROR_CODES.NOT_FOUND);
  const [members, subscription, connectors] = await Promise.all([
    OrganizationMember.find({ organizationId: organization._id, status: { $ne: 'REMOVED' } }).populate(
      'userId',
      'email'
    ),
    Subscription.findOne({ organizationId: organization._id }),
    Connector.find({ organizationId: organization._id }),
  ]);
  const plan = subscription ? await Plan.findById(subscription.planId) : null;
  return send(
    res,
    200,
    {
      organization,
      members: members.map((m) => ({
        id: m._id,
        email: m.userId?.email,
        role: m.role,
        status: m.status,
      })),
      subscription: subscription
        ? {
            id: subscription._id,
            status: subscription.status,
            fromDate: subscription.fromDate,
            toDate: subscription.toDate,
            extraSeats: subscription.extraSeats,
            source: subscription.source,
            plan: plan ? { id: plan._id, name: plan.name } : null,
            history: subscription.history,
          }
        : null,
      connectors,
    },
    'Organization detail'
  );
});

const manualValidators = [
  body('email').isEmail(),
  body('planId').isMongoId(),
  body('fromDate').isISO8601(),
  body('toDate').isISO8601(),
  body('extraSeats').optional().isInt({ min: 0 }),
  body('organizationName').optional().isString(),
];

const createManual = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase().trim();
  const user = await ensureUser(email);
  user.isVerified = true;
  await user.save();
  const { organization } = await ensureOwnerOrg(user, req.body.organizationName);
  const plan = await Plan.findById(req.body.planId);
  if (!plan) throw new ApiError(404, 'Plan not found', ERROR_CODES.PLAN_NOT_FOUND);

  const fromDate = new Date(req.body.fromDate);
  const toDate = new Date(req.body.toDate);
  if (toDate <= fromDate) {
    throw new ApiError(400, 'toDate must be after fromDate', ERROR_CODES.VALIDATION_ERROR);
  }

  const subscription = await applySubscription({
    organizationId: organization._id,
    planId: plan._id,
    source: 'MANUAL',
    fromDate,
    toDate,
    extraSeats: Number(req.body.extraSeats || 0),
    actorType: 'SUPER_ADMIN',
    actorId: req.user._id,
    action: 'CREATED',
  });

  return send(
    res,
    201,
    {
      organization: { id: organization._id, name: organization.name },
      user: { id: user._id, email: user.email },
      subscription: {
        id: subscription._id,
        status: subscription.status,
        fromDate: subscription.fromDate,
        toDate: subscription.toDate,
        extraSeats: subscription.extraSeats,
        source: subscription.source,
      },
    },
    'Manual subscription saved'
  );
});

const patchValidators = [
  param('id').isMongoId(),
  body('planId').optional().isMongoId(),
  body('fromDate').optional().isISO8601(),
  body('toDate').optional().isISO8601(),
  body('extraSeats').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['ACTIVE', 'EXPIRED']),
];

const patchSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) throw new ApiError(404, 'Subscription not found', ERROR_CODES.NOT_FOUND);

  const previousPlanId = subscription.planId;
  if (req.body.planId) subscription.planId = req.body.planId;
  if (req.body.fromDate) subscription.fromDate = new Date(req.body.fromDate);
  if (req.body.toDate) subscription.toDate = new Date(req.body.toDate);
  if (req.body.extraSeats !== undefined) subscription.extraSeats = req.body.extraSeats;

  if (subscription.toDate < new Date()) {
    subscription.status = 'EXPIRED';
  } else if (req.body.status) {
    subscription.status = req.body.status;
  } else {
    subscription.status = 'ACTIVE';
  }

  const action =
    req.body.planId && String(req.body.planId) !== String(previousPlanId)
      ? 'PLAN_CHANGED'
      : 'UPDATED';

  subscription.history.push({
    action,
    at: new Date(),
    actorType: 'SUPER_ADMIN',
    actorId: req.user._id,
    meta: {
      planId: subscription.planId,
      previousPlanId,
      fromDate: subscription.fromDate,
      toDate: subscription.toDate,
      extraSeats: subscription.extraSeats,
    },
  });
  await subscription.save();
  await logAudit({
    organizationId: subscription.organizationId,
    actorType: 'SUPER_ADMIN',
    actorId: req.user._id,
    action: `SUBSCRIPTION_${action}`,
    meta: { subscriptionId: subscription._id },
  });

  return send(
    res,
    200,
    {
      subscription: {
        id: subscription._id,
        planId: subscription.planId,
        status: subscription.status,
        fromDate: subscription.fromDate,
        toDate: subscription.toDate,
        extraSeats: subscription.extraSeats,
        source: subscription.source,
      },
    },
    'Subscription updated'
  );
});

const subscriptionHistory = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) throw new ApiError(404, 'Subscription not found', ERROR_CODES.NOT_FOUND);
  const audits = await AuditLog.find({
    organizationId: subscription.organizationId,
    action: { $regex: /^SUBSCRIPTION_/ },
  }).sort({ createdAt: -1 });
  return send(
    res,
    200,
    { subscriptionId: subscription._id, history: subscription.history, audits },
    'History'
  );
});

const listPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find().sort({ createdAt: -1 });
  return send(res, 200, { plans }, 'Plans');
});

const planBodyValidators = [
  body('name').isString().notEmpty(),
  body('description').optional().isString(),
  body('features').isArray(),
  body('seatLimit').isInt({ min: 1 }),
  body('pricingOptions').isArray({ min: 1 }),
  body('addonPricePerSeat').isFloat({ min: 0 }),
  body('isActive').optional().isBoolean(),
];

const createPlan = asyncHandler(async (req, res) => {
  const plan = await Plan.create({
    name: req.body.name,
    description: req.body.description || '',
    features: req.body.features,
    seatLimit: req.body.seatLimit,
    pricingOptions: req.body.pricingOptions,
    addonPricePerSeat: req.body.addonPricePerSeat,
    isActive: req.body.isActive !== false,
  });
  await logAudit({
    organizationId: null,
    actorType: 'SUPER_ADMIN',
    actorId: req.user._id,
    action: 'PLAN_CREATED',
    meta: { planId: plan._id, name: plan.name },
  });
  return send(res, 201, { plan }, 'Plan created');
});

const patchPlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Plan not found', ERROR_CODES.PLAN_NOT_FOUND);
  const fields = [
    'name',
    'description',
    'features',
    'seatLimit',
    'pricingOptions',
    'addonPricePerSeat',
    'isActive',
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) plan[f] = req.body[f];
  });
  await plan.save();
  await logAudit({
    organizationId: null,
    actorType: 'SUPER_ADMIN',
    actorId: req.user._id,
    action: 'PLAN_UPDATED',
    meta: { planId: plan._id },
  });
  return send(res, 200, { plan }, 'Plan updated');
});

const listConnectors = asyncHandler(async (req, res) => {
  const connectors = await Connector.find().sort({ lastHeartbeatAt: -1 });
  return send(
    res,
    200,
    {
      connectors: connectors.map((c) => ({
        id: c._id,
        organizationId: c.organizationId,
        deviceId: c.deviceId,
        deviceName: c.deviceName,
        status: c.status,
        lastHeartbeatAt: c.lastHeartbeatAt,
        tallyConnected: c.tallyConnected,
        connectorVersion: c.connectorVersion,
      })),
    },
    'Connectors'
  );
});

module.exports = {
  sendOtp,
  verifyOtpHandler,
  sendOtpValidators,
  verifyOtpValidators,
  listOrganizations,
  getOrganization,
  createManual,
  manualValidators,
  patchSubscription,
  patchValidators,
  subscriptionHistory,
  listPlans,
  createPlan,
  patchPlan,
  planBodyValidators,
  listConnectors,
};
