const mongoose = require("mongoose");

const reminderTemplateSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    message: {
      type: String,
      default:
        "Dear {customerName}, your outstanding balance of ₹{outstandingAmount} is pending. Kindly clear it at the earliest. Thank you - {companyName}",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ReminderTemplate", reminderTemplateSchema);
