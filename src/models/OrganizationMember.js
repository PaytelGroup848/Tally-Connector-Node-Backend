const mongoose = require("mongoose");
const {
  ROLE,
  MODULE_KEYS,
  ALL_ALLOWED_MODULE_KEYS,
} = require("../constants/permissions");

const dayScheduleSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    from: { type: String, default: "10:00" }, // "HH:mm", 24-hour, IST
    to: { type: String, default: "19:00" },
  },
  { _id: false },
);

const loginScheduleSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false }, // "Restrict Outside Office Hours" master toggle
    days: {
      monday: { type: dayScheduleSchema, default: () => ({}) },
      tuesday: { type: dayScheduleSchema, default: () => ({}) },
      wednesday: { type: dayScheduleSchema, default: () => ({}) },
      thursday: { type: dayScheduleSchema, default: () => ({}) },
      friday: { type: dayScheduleSchema, default: () => ({}) },
      saturday: { type: dayScheduleSchema, default: () => ({}) },
      sunday: { type: dayScheduleSchema, default: () => ({ enabled: false }) },
    },
  },
  { _id: false },
);

const organizationMemberSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(ROLE),
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INVITED", "REMOVED"],
      default: "ACTIVE",
      index: true,
    },

    allowedModules: {
      type: [String],
      enum: ALL_ALLOWED_MODULE_KEYS,
      default: () => [...MODULE_KEYS],
    },
    allowedCompanies: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Company",
      default: [],
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isSuspended: { type: Boolean, default: false },
    loginSchedule: { type: loginScheduleSchema, default: () => ({}) },
  },
  { timestamps: true },
);

organizationMemberSchema.index(
  { organizationId: 1, userId: 1 },
  { unique: true },
);
organizationMemberSchema.index(
  { userId: 1, status: 1, createdAt: 1 },
  { background: true },
);

module.exports = mongoose.model("OrganizationMember", organizationMemberSchema);
