const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ReminderTemplate = require("../models/ReminderTemplate");

const DEFAULT_MESSAGE =
  "Dear {customerName}, your outstanding balance of ₹{outstandingAmount} is pending. Kindly clear it at the earliest. Thank you - {companyName}";

const getTemplate = asyncHandler(async (req, res) => {
  let template = await ReminderTemplate.findOne({
    organizationId: req.organizationId,
  });
  if (!template) {
    template = { message: DEFAULT_MESSAGE };
  }
  return send(res, 200, { message: template.message }, "Reminder template");
});

const updateTemplate = asyncHandler(async (req, res) => {
  const { message } = req.body;
  const template = await ReminderTemplate.findOneAndUpdate(
    { organizationId: req.organizationId },
    { $set: { message } },
    { upsert: true, new: true },
  );
  return send(res, 200, { message: template.message }, "Template updated");
});

module.exports = { getTemplate, updateTemplate };
