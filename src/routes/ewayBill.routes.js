const express = require("express");
const validate = require("../middlewares/validate.middleware");
const webAuth = require("../middlewares/webAuth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../constants/permissions");
const ctrl = require("../controllers/ewayBill.controller");

const router = express.Router();
router.use(webAuth);

router.post(
  "/:id/eway-bills",
  // requirePermission(PERMISSIONS.EWAY_BILL_GENERATE),
  ctrl.generateValidators,
  validate,
  ctrl.generate,
);
router.get(
  "/:id/eway-bills",
  // requirePermission(PERMISSIONS.EWAY_BILL_GENERATE),
  ctrl.list,
);
router.get(
  "/:id/eway-bills/:ewbId",
  // requirePermission(PERMISSIONS.EWAY_BILL_GENERATE),
  ctrl.getOne,
);
router.post(
  "/:id/eway-bills/:ewbId/cancel",
  // requirePermission(PERMISSIONS.EWAY_BILL_GENERATE),
  ctrl.cancel,
);

module.exports = router;
