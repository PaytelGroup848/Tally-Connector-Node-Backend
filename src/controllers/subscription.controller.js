const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');
const Plan = require('../models/Plan');
const { getOrExpireSubscription } = require('../services/subscription.service');

const getMine = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    throw new ApiError(404, 'Organization not found', ERROR_CODES.NOT_FOUND);
  }
  const subscription = await getOrExpireSubscription(req.organizationId);
  if (!subscription) {
    return send(res, 200, { subscription: null }, 'No subscription');
  }
  const plan = await Plan.findById(subscription.planId);
  return send(
    res,
    200,
    {
      subscription: {
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
              features: plan.features,
              seatLimit: plan.seatLimit,
              addonPricePerSeat: plan.addonPricePerSeat,
            }
          : null,
      },
    },
    'Subscription'
  );
});

module.exports = { getMine };
