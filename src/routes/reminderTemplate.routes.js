const express = require("express");
const webAuth = require("../middlewares/webAuth.middleware");
const { requireRolePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../constants/permissions");
const ctrl = require("../controllers/reminderTemplate.controller");

const router = express.Router();
router.use(webAuth);

router.get(
  "/",
  requireRolePermission(PERMISSIONS.ORG_UPDATE),
  ctrl.getTemplate,
);
router.patch(
  "/",
  requireRolePermission(PERMISSIONS.ORG_UPDATE),
  ctrl.updateTemplate,
);

module.exports = router;
