const Razorpay = require('razorpay');

let client = null;

const getRazorpay = () => {
  if (client) return client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Razorpay keys are not configured');
  }
  client = new Razorpay({ key_id, key_secret });
  return client;
};

module.exports = { getRazorpay };
