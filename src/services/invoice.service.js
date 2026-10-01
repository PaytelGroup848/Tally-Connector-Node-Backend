const Invoice = require("../models/Invoice");

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();

  const count = await Invoice.countDocuments({
    invoiceNumber: new RegExp(`^CLD-${year}-`),
  });

  return `Ctrl-${year}-${String(count + 1).padStart(4, "0")}`;
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
  // Prevent duplicate invoice if Razorpay verify API is called twice
  const existing = await Invoice.findOne({
    razorpayPaymentId: paymentId,
  });

  if (existing) {
    return existing;
  }

  const invoiceNumber = await generateInvoiceNumber();

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
};

module.exports = {
  createSubscriptionInvoice,
};
