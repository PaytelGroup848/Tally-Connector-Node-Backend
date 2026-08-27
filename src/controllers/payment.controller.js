const { body } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');
const Plan = require('../models/Plan');
const {
  createOrder,
  verifyPaymentSignature,
  resolvePayableAmount,
} = require('../services/razorpay.service');
const { applySubscription, addMonths, getOrExpireSubscription } = require('../services/subscription.service');

const createOrderValidators = [
  body('planId').isMongoId().withMessage('planId is required'),
  body('durationMonths').isInt({ min: 1 }).withMessage('durationMonths is required'),
  body('extraSeats').optional().isInt({ min: 0 }),
];

const verifyValidators = [
  body('razorpay_order_id').isString().notEmpty(),
  body('razorpay_payment_id').isString().notEmpty(),
  body('razorpay_signature').isString().notEmpty(),
];

const createOrderHandler = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    throw new ApiError(400, 'Organization required', ERROR_CODES.NOT_FOUND);
  }
  const { planId, durationMonths, extraSeats = 0 } = req.body;
  const plan = await Plan.findOne({ _id: planId, isActive: true });
  if (!plan) throw new ApiError(404, 'Plan not found', ERROR_CODES.PLAN_NOT_FOUND);

  const option = plan.pricingOptions.find(
    (o) => Number(o.durationMonths) === Number(durationMonths)
  );
  if (!option) {
    throw new ApiError(400, 'Invalid duration for this plan', ERROR_CODES.VALIDATION_ERROR);
  }

  const base = resolvePayableAmount(option);
  const seats = Number(extraSeats) || 0;
  const addon = seats * Number(plan.addonPricePerSeat || 0);
  const amountRupees = base + addon;

  const order = await createOrder({
    amountRupees,
    receipt: `org_${req.organizationId}_${Date.now()}`.slice(0, 40),
    notes: {
      organizationId: String(req.organizationId),
      userId: String(req.user._id),
      planId: String(plan._id),
      durationMonths: String(durationMonths),
      extraSeats: String(seats),
    },
  });

  return send(
    res,
    200,
    {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan: { id: plan._id, name: plan.name, durationMonths, extraSeats: seats },
    },
    'Order created'
  );
});

const verifyHandler = asyncHandler(async (req, res) => {
  const razorpayOrderId = req.body.razorpay_order_id;
  const razorpayPaymentId = req.body.razorpay_payment_id;
  const razorpaySignature = req.body.razorpay_signature;

  verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });

  const { getRazorpay } = require('../config/razorpay');
  const order = await getRazorpay().orders.fetch(razorpayOrderId);
  const notes = order.notes || {};
  if (String(notes.organizationId) !== String(req.organizationId)) {
    throw new ApiError(403, 'Order does not belong to this organization', ERROR_CODES.FORBIDDEN);
  }

  const plan = await Plan.findById(notes.planId);
  if (!plan) throw new ApiError(404, 'Plan not found', ERROR_CODES.PLAN_NOT_FOUND);

  const durationMonths = Number(notes.durationMonths);
  const extraSeats = Number(notes.extraSeats || 0);
  const fromDate = new Date();
  const toDate = addMonths(fromDate, durationMonths);

  const subscription = await applySubscription({
    organizationId: req.organizationId,
    planId: plan._id,
    source: 'RAZORPAY',
    fromDate,
    toDate,
    extraSeats,
    razorpayOrderId,
    razorpayPaymentId,
    actorType: 'USER',
    actorId: req.user._id,
    action: 'CREATED',
  });

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
        planId: subscription.planId,
        source: subscription.source,
      },
    },
    'Payment verified'
  );
});

module.exports = {
  createOrderValidators,
  verifyValidators,
  createOrderHandler,
  verifyHandler,
  getOrExpireSubscription,
};
