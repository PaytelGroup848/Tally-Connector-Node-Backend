const crypto = require('crypto');
const { getRazorpay } = require('../config/razorpay');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');

const amountInPaise = (rupees) => Math.round(Number(rupees) * 100);

const createOrder = async ({ amountRupees, receipt, notes }) => {
  const razorpay = getRazorpay();
  return razorpay.orders.create({
    amount: amountInPaise(amountRupees),
    currency: 'INR',
    receipt,
    notes: notes || {},
  });
};

const verifyPaymentSignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const valid = expected === razorpaySignature;
  if (!valid) {
    throw new ApiError(400, 'Invalid Razorpay signature', ERROR_CODES.INVALID_SIGNATURE);
  }
  return true;
};

const resolvePayableAmount = (pricingOption) => {
  const price = Number(pricingOption.price);
  const discount = Number(pricingOption.discountPercent || 0);
  return Math.max(0, price - (price * discount) / 100);
};

module.exports = { createOrder, verifyPaymentSignature, resolvePayableAmount, amountInPaise };
