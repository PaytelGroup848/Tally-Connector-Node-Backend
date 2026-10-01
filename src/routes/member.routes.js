const express = require("express");
const validate = require("../middlewares/validate.middleware");
const webAuth = require("../middlewares/webAuth.middleware");
const { requireRolePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../constants/permissions");
const ctrl = require("../controllers/member.controller");

const router = express.Router();

router.use(webAuth);

router.get("/", requireRolePermission(PERMISSIONS.MEMBER_MANAGE), ctrl.list);
router.post(
  "/invite",
  requireRolePermission(PERMISSIONS.MEMBER_INVITE),
  ctrl.inviteValidators,
  validate,
  ctrl.invite,
);
router.patch(
  "/:id/role",
  requireRolePermission(PERMISSIONS.MEMBER_MANAGE),
  ctrl.roleValidators,
  validate,
  ctrl.changeRole,
);
router.patch(
  "/:id/modules",
  requireRolePermission(PERMISSIONS.MEMBER_MANAGE),
  ctrl.modulesValidators,
  validate,
  ctrl.updateModules,
);
router.delete(
  "/:id",
  requireRolePermission(PERMISSIONS.MEMBER_MANAGE),
  ctrl.remove,
);

router.patch(
  "/:id/suspend",
  requireRolePermission(PERMISSIONS.MEMBER_MANAGE),
  ctrl.suspendValidators,
  validate,
  ctrl.toggleSuspend,
);
router.patch(
  "/:id/schedule",
  requireRolePermission(PERMISSIONS.MEMBER_MANAGE),
  ctrl.scheduleValidators,
  validate,
  ctrl.updateSchedule,
);

module.exports = router;
