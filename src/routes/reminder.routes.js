const express = require("express");
const validate = require("../middlewares/validate.middleware");
const webAuth = require("../middlewares/webAuth.middleware");
const { requireRolePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../constants/permissions");
const ctrl = require("../controllers/reminder.controller");

const router = express.Router();
router.use(webAuth);

router.post(
  "/:id/reminders/email",
  ctrl.sendEmailValidators,
  validate,
  ctrl.sendEmailReminder,
);

module.exports = router;
