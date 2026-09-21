const axios = require("axios");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

const sendReminderEmail = async ({ to, toName, subject, html }) => {
  try {
    await axios.post(
      BREVO_SEND_URL,
      {
        sender: {
          name: process.env.BREVO_REMINDER_SENDER_NAME,
          email: process.env.BREVO_REMINDER_SENDER_EMAIL,
        },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": process.env.BREVO_REMINDER_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    const description =
      err?.response?.data?.message || "Failed to send reminder email";
    throw new ApiError(
      err?.response?.status || 502,
      description,
      ERROR_CODES.EMAIL_SEND_FAILED,
    );
  }
};

module.exports = { sendReminderEmail };
