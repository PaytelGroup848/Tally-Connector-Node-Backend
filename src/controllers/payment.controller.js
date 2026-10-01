const { body } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const Plan = require("../models/Plan");
const {
  createOrder,
  verifyPaymentSignature,
  resolvePayableAmount,
} = require("../services/razorpay.service");
const { logAudit } = require("../services/audit.service");
const {
  applySubscription,
  addMonths,
} = require("../services/subscription.service");
const Subscription = require("../models/Subscription");
const { createSubscriptionInvoice } = require("../services/invoice.service");

const createOrderValidators = [
  body("planId").isMongoId().withMessage("planId is required"),
  body("durationMonths")
    .isInt({ min: 1 })
    .withMessage("durationMonths is required"),
  body("extraSeats").optional().isInt({ min: 0 }),
];

const verifyValidators = [
  body("razorpay_order_id").isString().notEmpty(),
  body("razorpay_payment_id").isString().notEmpty(),
  body("razorpay_signature").isString().notEmpty(),
];

const createOrderHandler = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    throw new ApiError(400, "Organization required", ERROR_CODES.NOT_FOUND);
  }
  const { planId, durationMonths, extraSeats = 0 } = req.body;
  const plan = await Plan.findOne({ _id: planId, isActive: true }).lean();
  if (!plan)
    throw new ApiError(404, "Plan not found", ERROR_CODES.PLAN_NOT_FOUND);

  const option = plan.pricingOptions.find(
    (o) => Number(o.durationMonths) === Number(durationMonths),
  );
  if (!option) {
    throw new ApiError(
      400,
      "Invalid duration for this plan",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const base = resolvePayableAmount(option);
  const seats = Number(extraSeats) || 0;
  const addon = seats * Number(option.addonPricePerSeat || 0);
  const subtotal = base + addon;

  const gstPercent = Number(process.env.GST_PERCENT || 18);
  const gstAmount = Math.round(subtotal * (gstPercent / 100) * 100) / 100;
  const amountRupees = subtotal + gstAmount; // <-- Razorpay ko ye final (GST-inclusive) amount jayega

  const order = await createOrder({
    amountRupees,
    receipt: `org_${req.organizationId}_${Date.now()}`.slice(0, 40),
    notes: {
      organizationId: String(req.organizationId),
      userId: String(req.user._id),
      planId: String(plan._id),
      durationMonths: String(durationMonths),
      extraSeats: String(seats),

      subtotal: String(subtotal),
      gstPercent: String(gstPercent),
      gstAmount: String(gstAmount),
      totalAmount: String(amountRupees),
    },
  });
  console.log("this is my order", order);

  return send(
    res,
    200,
    {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      breakdown: {
        subtotal,
        gstPercent,
        gstAmount,
        totalAmount: amountRupees,
      },
      plan: {
        id: plan._id,
        name: plan.name,
        durationMonths,
        extraSeats: seats,
      },
    },
    "Order created",
  );
});

const verifyHandler = asyncHandler(async (req, res) => {
  const razorpayOrderId = req.body.razorpay_order_id;
  const razorpayPaymentId = req.body.razorpay_payment_id;
  const razorpaySignature = req.body.razorpay_signature;

  verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  const { getRazorpay } = require("../config/razorpay");
  const order = await getRazorpay().orders.fetch(razorpayOrderId);
  const notes = order.notes || {};
  if (String(notes.organizationId) !== String(req.organizationId)) {
    throw new ApiError(
      403,
      "Order does not belong to this organization",
      ERROR_CODES.FORBIDDEN,
    );
  }

  const plan = await Plan.findById(notes.planId).lean();
  if (!plan)
    throw new ApiError(404, "Plan not found", ERROR_CODES.PLAN_NOT_FOUND);

  const durationMonths = Number(notes.durationMonths);
  const extraSeats = Number(notes.extraSeats || 0);
  const fromDate = new Date();
  const toDate = addMonths(fromDate, durationMonths);

  const subscription = await applySubscription({
    organizationId: req.organizationId,
    planId: plan._id,
    source: "RAZORPAY",
    fromDate,
    toDate,
    extraSeats,
    razorpayOrderId,
    razorpayPaymentId,
    actorType: "USER",
    actorId: req.user._id,
    action: "CREATED",
  });

  const subtotal = Number(notes.subtotal || 0);
  const gstPercent = Number(notes.gstPercent || 18);
  const gstAmount = Number(notes.gstAmount || 0);

  // Razorpay amount is in paise
  const totalAmount = Number(order.amount) / 100;

  const invoice = await createSubscriptionInvoice({
    organizationId: req.organizationId,
    userId: req.user._id,

    subscription,
    plan,
    order,

    paymentId: razorpayPaymentId,

    subtotal,
    gstPercent,
    gstAmount,
    totalAmount,

    durationMonths,
    extraSeats,

    billingTo: {
      name: req.user.name || "",
      email: req.user.email || "",
      phone: req.user.phone || "",
    },

    seller: {
      name: "Cloudedata",
    },
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

      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        status: invoice.status,
        subtotal: invoice.subtotal,
        gstPercent: invoice.gstPercent,
        gstAmount: invoice.gstAmount,
        totalAmount: invoice.totalAmount,
      },
    },
    "Payment verified",
  );
});

const resolveCurrentDurationOption = (plan, subscription) => {
  const days =
    (subscription.toDate - subscription.fromDate) / (1000 * 60 * 60 * 24);
  const approxMonths = days / 30;

  let closest = plan.pricingOptions[0];
  let smallestDiff = Infinity;
  for (const option of plan.pricingOptions) {
    const diff = Math.abs(option.durationMonths - approxMonths);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = option;
    }
  }
  return closest;
};

const createSeatOrderValidators = [
  body("seats").isInt({ min: 1 }).withMessage("seats must be at least 1"),
];

const createSeatOrderHandler = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    throw new ApiError(400, "Organization required", ERROR_CODES.NOT_FOUND);
  }

  const seatsToAdd = Number(req.body.seats);

  const subscription = await Subscription.findOne({
    organizationId: req.organizationId,
  });
  if (!subscription) {
    throw new ApiError(
      402,
      "No subscription found",
      ERROR_CODES.SUBSCRIPTION_REQUIRED,
    );
  }
  if (!subscription.isCurrentlyActive()) {
    throw new ApiError(
      402,
      "Subscription has expired",
      ERROR_CODES.SUBSCRIPTION_EXPIRED,
    );
  }

  const plan = await Plan.findById(subscription.planId).lean();
  if (!plan)
    throw new ApiError(404, "Plan not found", ERROR_CODES.PLAN_NOT_FOUND);

  const option = resolveCurrentDurationOption(plan, subscription);
  const perSeatRate = Number(option.addonPricePerSeat || 0);
  const subtotal = perSeatRate * seatsToAdd;

  const gstPercent = Number(process.env.GST_PERCENT || 18);
  const gstAmount = Math.round(subtotal * (gstPercent / 100) * 100) / 100;
  const amountRupees = subtotal + gstAmount;

  const order = await createOrder({
    amountRupees,
    receipt: `seats_${req.organizationId}_${Date.now()}`.slice(0, 40),
    notes: {
      type: "SEAT_ADDON",
      organizationId: String(req.organizationId),
      userId: String(req.user._id),
      subscriptionId: String(subscription._id),
      seatsToAdd: String(seatsToAdd),
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
      breakdown: {
        perSeatRate,
        seatsToAdd,
        subtotal,
        gstPercent,
        gstAmount,
        totalAmount: amountRupees,
      },
    },
    "Seat order created",
  );
});

const verifySeatOrderHandler = asyncHandler(async (req, res) => {
  const razorpayOrderId = req.body.razorpay_order_id;
  const razorpayPaymentId = req.body.razorpay_payment_id;
  const razorpaySignature = req.body.razorpay_signature;

  verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  const { getRazorpay } = require("../config/razorpay");
  const order = await getRazorpay().orders.fetch(razorpayOrderId);
  const notes = order.notes || {};

  if (notes.type !== "SEAT_ADDON") {
    throw new ApiError(
      400,
      "Order is not a seat add-on order",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }
  if (String(notes.organizationId) !== String(req.organizationId)) {
    throw new ApiError(
      403,
      "Order does not belong to this organization",
      ERROR_CODES.FORBIDDEN,
    );
  }

  const subscription = await Subscription.findById(notes.subscriptionId);
  if (!subscription) {
    throw new ApiError(404, "Subscription not found", ERROR_CODES.NOT_FOUND);
  }

  if (
    String(subscription._id) !==
    String(
      (await Subscription.findOne({ organizationId: req.organizationId }).lean())
        ._id,
    )
  ) {
    throw new ApiError(
      409,
      "Subscription has changed since this order was created",
      ERROR_CODES.CONFLICT,
    );
  }

  const seatsToAdd = Number(notes.seatsToAdd || 0);
  const previousExtraSeats = subscription.extraSeats;
  subscription.extraSeats = previousExtraSeats + seatsToAdd;

  subscription.history.push({
    action: "SEATS_ADDED",
    at: new Date(),
    actorType: "USER",
    actorId: req.user._id,
    meta: {
      seatsAdded: seatsToAdd,
      previousExtraSeats,
      newExtraSeats: subscription.extraSeats,
      razorpayOrderId,
      razorpayPaymentId,
    },
  });

  await subscription.save();

  await logAudit({
    organizationId: req.organizationId,
    actorType: "USER",
    actorId: req.user._id,
    action: "SUBSCRIPTION_SEATS_ADDED",
    meta: { seatsAdded: seatsToAdd, newExtraSeats: subscription.extraSeats },
  });

  return send(
    res,
    200,
    {
      subscription: {
        id: subscription._id,
        extraSeats: subscription.extraSeats,
        toDate: subscription.toDate,
      },
    },
    "Seats added",
  );
});

module.exports = {
  createOrderValidators,
  verifyValidators,
  createOrderHandler,
  verifyHandler,
  createSeatOrderValidators,
  createSeatOrderHandler,
  verifySeatOrderHandler,
};
