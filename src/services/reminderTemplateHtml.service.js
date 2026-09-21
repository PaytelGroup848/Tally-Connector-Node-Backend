const buildReminderEmailHtml = ({
  customerName,
  outstandingAmount,
  companyName,
  message,
}) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#1f2937;padding:20px 32px;">
              <span style="color:#ffffff;font-size:18px;font-weight:bold;">${companyName || "Payment Reminder"}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="font-size:15px;color:#111827;margin:0 0 16px;">Dear <strong>${customerName}</strong>,</p>
              <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;">${message}</p>
              <table cellpadding="0" cellspacing="0" style="width:100%;background:#fef3f2;border:1px solid #fecaca;border-radius:6px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;text-align:center;">
                    <div style="font-size:12px;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;">Outstanding Amount</div>
                    <div style="font-size:24px;color:#b91c1c;font-weight:bold;margin-top:4px;">${outstandingAmount}</div>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px;color:#6b7280;margin:0;">Kindly arrange the payment at the earliest to avoid any inconvenience.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="font-size:11px;color:#9ca3af;margin:0;">This is an automated reminder from ${companyName || "your service provider"}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

module.exports = { buildReminderEmailHtml };
