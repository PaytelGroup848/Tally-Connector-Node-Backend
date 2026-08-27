const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const Plan = require('../models/Plan');

const listPublicPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ isActive: true }).sort({ createdAt: 1 });
  return send(
    res,
    200,
    {
      plans: plans.map((p) => ({
        id: p._id,
        name: p.name,
        description: p.description,
        features: p.features,
        seatLimit: p.seatLimit,
        pricingOptions: p.pricingOptions,
        addonPricePerSeat: p.addonPricePerSeat,
      })),
    },
    'Plans'
  );
});

module.exports = { listPublicPlans };
