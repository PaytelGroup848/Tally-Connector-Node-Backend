const express = require("express");
const validate = require("../middlewares/validate.middleware");
const webAuth = require("../middlewares/webAuth.middleware");
const { requireRolePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../constants/permissions");
const ctrl = require("../controllers/gspSettings.controller");

const router = express.Router();
router.use(webAuth);

router.get(
  "/",
  requireRolePermission(PERMISSIONS.GSP_SETTINGS_MANAGE),
  ctrl.getSettings,
);
router.put(
  "/",
  requireRolePermission(PERMISSIONS.GSP_SETTINGS_MANAGE),
  ctrl.saveValidators,
  validate,
  ctrl.saveSettings,
);

module.exports = router;
