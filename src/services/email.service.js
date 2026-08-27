const { getBrevoClient } = require('../config/brevo');

const sendTransactionalEmail = async ({ to, subject, htmlContent, textContent }) => {
  const client = getBrevoClient();
  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME || 'LiveKeeping',
    },
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent: textContent || undefined,
  };

  const { data } = await client.post('/smtp/email', payload);
  return data;
};

const sendOtpEmail = async (to, otp, expiryMinutes, contextLabel) => {
  const subject = `Your ${contextLabel} login OTP`;
  const htmlContent = `
    <p>Your one-time password is:</p>
    <p style="font-size:24px;letter-spacing:4px;"><strong>${otp}</strong></p>
    <p>This code expires in ${expiryMinutes} minutes. If you did not request it, ignore this email.</p>
  `;
  return sendTransactionalEmail({
    to,
    subject,
    htmlContent,
    textContent: `Your OTP is ${otp}. It expires in ${expiryMinutes} minutes.`,
  });
};

module.exports = { sendTransactionalEmail, sendOtpEmail };
