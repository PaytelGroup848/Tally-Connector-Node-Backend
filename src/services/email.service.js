const { getBrevoClient } = require("../config/brevo");

const BRAND_NAME = process.env.BREVO_SENDER_NAME || "CtrlBooks";
const BRAND_DOMAIN = process.env.CTRLBOOK_DOMAIN || "ctrlbook.com";
const LOGO_URL =
  process.env.CTRLBOOK_LOGO_URL || `https://${BRAND_DOMAIN}/ctrlbook.png`;

// Brand colors pulled from the CtrlBooks logo
const BRAND_BLUE = "#0099e6"; // Ctrl + right half of hexagon
const BRAND_GREEN = "#7ac142"; // Books + left half of hexagon

const sendTransactionalEmail = async ({
  to,
  subject,
  htmlContent,
  textContent,
}) => {
  const client = getBrevoClient();
  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: BRAND_NAME,
    },
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent: textContent || undefined,
  };

  const { data } = await client.post("/smtp/email", payload);
  return data;
};

/**
 * Build CtrlBooks-branded OTP email HTML
 */
const buildOtpEmailHtml = ({ otp, expiryMinutes, contextLabel }) => {
  // Split OTP into individual digits for visual styling
  const otpDigits = String(otp).split("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your CtrlBooks OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Your CtrlBooks verification code is ${otp}. Valid for ${expiryMinutes} minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fb;padding:40px 16px;">
    <tr>
      <td align="center">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,0.08);">

          <!-- Top accent bar -->
          <tr>
            <td style="height:6px;background:linear-gradient(90deg,${BRAND_GREEN} 0%,${BRAND_GREEN} 50%,${BRAND_BLUE} 50%,${BRAND_BLUE} 100%);line-height:6px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Logo -->
        <tr>
  <td align="center" style="padding:36px 40px 8px 40px;">
    <img
      src="${LOGO_URL}"
      alt="CtrlBooks"
      width="220"
      height="55"
      style="display:block;width:220px;height:55px;max-width:220px;border:0;outline:none;text-decoration:none;"
    />
  </td>
</tr>

          <!-- Heading -->
          <tr>
            <td align="center" style="padding:1px 40px 0 40px;">
              <h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
                Verify your login
              </h1>
              <p style="margin:10px 0 0 0;font-size:14px;line-height:1.55;color:#64748b;">
                Use the code below to sign in to your
                <strong style="color:#0f172a;">CtrlBooks</strong> account
              </p>
            </td>
          </tr>

          <!-- OTP digits -->
          <tr>
            <td align="center" style="padding:32px 40px 8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${otpDigits
                    .map(
                      (d) => `
                  <td style="padding:0 4px;">
                    <div style="width:46px;height:56px;line-height:56px;background-color:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;text-align:center;font-size:24px;font-weight:700;color:${BRAND_BLUE};font-family:'Courier New',Courier,monospace;">${d}</div>
                  </td>`,
                    )
                    .join("")}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td align="center" style="padding:18px 40px 0 40px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                This code will expire in
                <strong style="color:#0f172a;">${expiryMinutes} minutes</strong>.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <div style="height:1px;background-color:#e2e8f0;line-height:1px;font-size:0;">&nbsp;</div>
            </td>
          </tr>

       

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 40px 36px 40px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                Sent with care by <strong style="color:#334155;">CtrlBooks</strong>
              </p>
              <p style="margin:6px 0 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
                <a href="https://${BRAND_DOMAIN}" style="color:${BRAND_BLUE};text-decoration:none;font-weight:600;">${BRAND_DOMAIN}</a>
              </p>
            </td>
          </tr>

        </table>

        <!-- Below-card small print -->
        <p style="margin:20px 0 0 0;font-size:11px;line-height:1.6;color:#94a3b8;text-align:center;max-width:560px;">
          This is an automated message. Please do not reply to this email.
        </p>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

/**
 * Send OTP email (branded)
 */
const sendOtpEmail = async (to, otp, expiryMinutes, contextLabel) => {
  const subject = `${otp} is your CtrlBooks verification code`;
  const htmlContent = buildOtpEmailHtml({ otp, expiryMinutes, contextLabel });
  const textContent = `Your CtrlBooks verification code is ${otp}. It expires in ${expiryMinutes} minutes. If you didn't request this, please ignore this email.`;

  return sendTransactionalEmail({
    to,
    subject,
    htmlContent,
    textContent,
  });
};

module.exports = { sendTransactionalEmail, sendOtpEmail };
