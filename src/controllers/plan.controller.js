const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const Plan = require("../models/Plan");

const listPublicPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ isActive: true }).sort({ createdAt: 1 }).lean();
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
    "Plans",
  );
});

const createPlan = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    features,
    seatLimit,
    pricingOptions,
    addonPricePerSeat,
    isActive,
  } = req.body;

  if (!name || !seatLimit || !pricingOptions || pricingOptions.length === 0) {
    return send(
      res,
      400,
      null,
      "name, seatLimit and at least one pricingOption are required",
    );
  }

  const plan = await Plan.create({
    name,
    description,
    features,
    seatLimit,
    pricingOptions,
    addonPricePerSeat,
    isActive,
  });

  return send(res, 201, { plan }, "Plan created");
});

module.exports = { listPublicPlans, createPlan };
