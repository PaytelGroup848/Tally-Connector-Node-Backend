const crypto = require("crypto");

const orderId = "order_Ti9YDX84xRB75y";
const paymentId = "rzp_test_TVXRj9s7Mj0HXe";

const keySecret = "XN6Vtvcrv5RPI6AY3ejJ095G";

const generatedSignature = crypto
  .createHmac("sha256", keySecret)
  .update(`${orderId}|${paymentId}`)
  .digest("hex");

console.log(generatedSignature);
