const { body } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const Company = require("../models/Company");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const ReminderTemplate = require("../models/ReminderTemplate");
const { sendReminderEmail } = require("../services/reminderMail.service");
const {
  buildReminderEmailHtml,
} = require("../services/reminderTemplateHtml.service");
const { logAudit } = require("../services/audit.service");
const { withPartyContact } = require("../utils/partyContact");

const DEFAULT_MESSAGE =
  "Your outstanding balance of ₹{outstandingAmount} is pending. Kindly clear it at the earliest.";

const sendEmailValidators = [
  body("partyId").isMongoId(),
  body("partyType").isIn(["CUSTOMER", "SUPPLIER"]),
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Math.abs(Number(amount) || 0),
  );

const sendEmailReminder = asyncHandler(async (req, res) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  }).lean();
  if (!company)
    throw new ApiError(404, "Company not found", ERROR_CODES.NOT_FOUND);

  const { partyId, partyType } = req.body;
  const Model = partyType === "SUPPLIER" ? Supplier : Customer;

  const party = await Model.findOne({
    _id: partyId,
    organizationId: req.organizationId,
    companyId: company._id,
  }).lean();
  if (!party) throw new ApiError(404, "Party not found", ERROR_CODES.NOT_FOUND);

  const contact = withPartyContact(party);
  if (!contact.email) {
    throw new ApiError(
      400,
      "This party has no email on file",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const templateDoc = await ReminderTemplate.findOne({
    organizationId: req.organizationId,
  }).lean();
  const template = templateDoc?.message || DEFAULT_MESSAGE;

  const formattedAmount = party.closingBalance;

  const messageBody = template
    .replace("{customerName}", party.name || "Customer")
    .replace("{outstandingAmount}", formattedAmount)
    .replace("{companyName}", company.tallyCompanyName || "");

  const html = buildReminderEmailHtml({
    customerName: party.name || "Customer",
    outstandingAmount: formattedAmount,
    companyName: company.tallyCompanyName || "",
    message: messageBody,
  });

  await sendReminderEmail({
    to: contact.email,
    toName: party.name,
    subject: `Payment Reminder — ${company.tallyCompanyName || ""}`,
    html,
  });

  await logAudit({
    organizationId: req.organizationId,
    actorType: "USER",
    actorId: req.user._id,
    action: "REMINDER_EMAIL_SENT",
    meta: { partyId, partyType, email: contact.email },
  });

  return send(res, 200, { sentTo: party.email }, "Reminder email sent");
});

module.exports = { sendEmailReminder, sendEmailValidators };
