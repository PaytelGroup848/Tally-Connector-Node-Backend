const { body } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const Organization = require("../models/Organization");
const Plan = require("../models/Plan");
const { getOrExpireSubscription } = require("../services/subscription.service");
const { logAudit } = require("../services/audit.service");

const updateValidators = [body("name").optional().isString().trim().notEmpty()];

const getMe = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    throw new ApiError(404, "Organization not found", ERROR_CODES.NOT_FOUND);
  }
  const organization = await Organization.findById(req.organizationId).lean();
  const subscription = await getOrExpireSubscription(req.organizationId);
  const plan = subscription ? await Plan.findById(subscription.planId).lean() : null;
  const ctx = req.authContext || {};

  return send(
    res,
    200,
    {
      organization: {
        id: organization._id,
        name: organization.name,
        ownerId: organization.ownerId,
        createdAt: organization.createdAt,
      },
      user: {
        id: req.user._id,
        email: req.user.email,
      },
      role: ctx.role,
      permissions: ctx.permissions || [],
      allowedModules: ctx.member?.allowedModules || null,
      subscription: subscription
        ? {
            id: subscription._id,
            status: subscription.status,
            fromDate: subscription.fromDate,
            toDate: subscription.toDate,
            extraSeats: subscription.extraSeats,
            source: subscription.source,
            active: subscription.isCurrentlyActive(),
            plan: plan
              ? {
                  id: plan._id,
                  name: plan.name,
                  seatLimit: plan.seatLimit,
                  features: plan.features,
                }
              : null,
          }
        : null,
    },
    "Organization",
  );
});

const updateMe = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    throw new ApiError(404, "Organization not found", ERROR_CODES.NOT_FOUND);
  }
  const organization = await Organization.findById(req.organizationId);
  if (req.body.name) organization.name = req.body.name;
  await organization.save();
  await logAudit({
    organizationId: organization._id,
    actorType: "USER",
    actorId: req.user._id,
    action: "ORG_UPDATED",
    meta: { name: organization.name },
  });
  return send(
    res,
    200,
    { organization: { id: organization._id, name: organization.name } },
    "Updated",
  );
});



module.exports = { getMe, updateMe, updateValidators };
