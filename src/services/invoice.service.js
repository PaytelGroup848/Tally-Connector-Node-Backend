const Invoice = require("../models/Invoice");
const Counter = require("../models/Counter");

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const key = `invoice-${year}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return `Ctrl-${year}-${String(counter.seq).padStart(4, "0")}`;
};

const createSubscriptionInvoice = async ({
  organizationId,
  userId,
  subscription,
  plan,
  order,
  paymentId,
  subtotal,
  gstPercent,
  gstAmount,
  totalAmount,
  durationMonths,
  extraSeats,
  billingTo = {},
  seller = {},
}) => {
  const existing = await Invoice.findOne({ razorpayPaymentId: paymentId });
  if (existing) return existing;

  const items = [
    {
      description: plan.name,
      service: `${plan.name} Subscription`,
      quantity: 1,
      rate: subtotal,
      gstRate: gstPercent,
      gstAmount,
      amount: subtotal,
    },
  ];

  if (extraSeats > 0) {
    const seatAmount =
      subtotal -
      Number(
        plan.pricingOptions?.find(
          (option) => Number(option.durationMonths) === Number(durationMonths),
        )?.price || 0,
      );

    if (seatAmount > 0) {
      items.push({
        description: `Additional Seats (${extraSeats})`,
        service: "Additional User Seats",
        quantity: extraSeats,
        rate: seatAmount / extraSeats,
        gstRate: gstPercent,
        gstAmount: 0,
        amount: seatAmount,
      });
    }
  }

  const MAX_RETRIES = 5;
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const invoiceNumber = await generateInvoiceNumber();

      const invoice = await Invoice.create({
        organizationId,
        userId,
        subscriptionId: subscription._id,
        invoiceNumber,
        invoiceDate: new Date(),
        paymentDate: new Date(),
        status: "PAID",
        currency: order.currency || "INR",
        subtotal,
        gstPercent,
        gstAmount,
        totalAmount,
        razorpayOrderId: order.id,
        razorpayPaymentId: paymentId,
        plan: {
          id: plan._id,
          name: plan.name,
          durationMonths,
          extraSeats,
        },
        billingTo,
        seller,
        items,
        metadata: {
          razorpayOrderId: order.id,
          razorpayPaymentId: paymentId,
        },
      });

      return invoice;
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.invoiceNumber) {
        lastError = err;
        continue;
      }

      if (err.code === 11000 && err.keyPattern?.razorpayPaymentId) {
        return await Invoice.findOne({ razorpayPaymentId: paymentId });
      }

      throw err;
    }
  }

  throw lastError;
};

module.exports = {
  createSubscriptionInvoice,
  generateInvoiceNumber,
};
