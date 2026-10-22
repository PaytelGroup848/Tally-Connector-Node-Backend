const express = require("express");
const validate = require("../middlewares/validate.middleware");
const webAuth = require("../middlewares/webAuth.middleware");
const {
  requirePermission,
  requireRolePermission,
  requireActiveSubscription,
} = require("../middlewares/rbac.middleware");
const companyAccessGuard = require("../middlewares/companyAccess.middleware");
const { PERMISSIONS } = require("../constants/permissions");
const {
  uploadLogo,
  uploadSignature,
} = require("../middlewares/upload.middleware");
const ctrl = require("../controllers/companySettings.controller");

const router = express.Router();

const read = [
  webAuth,
  companyAccessGuard,
  requirePermission(PERMISSIONS.COMPANY_READ),
];
const write = [
  webAuth,
  companyAccessGuard,
  requireActiveSubscription,
  requireRolePermission(PERMISSIONS.COMPANY_SETTINGS_MANAGE),
];

router.get(
  "/:id/settings",
  ...read,
  ctrl.idValidators,
  validate,
  ctrl.getProfile,
);
router.put(
  "/:id/settings",
  ...write,
  ctrl.profileValidators,
  validate,
  ctrl.updateProfile,
);
router.post(
  "/:id/settings/logo",
  ...write,
  ctrl.idValidators,
  validate,
  uploadLogo,
  ctrl.uploadLogoHandler,
);
router.delete(
  "/:id/settings/logo",
  ...write,
  ctrl.idValidators,
  validate,
  ctrl.removeLogo,
);

router.post(
  "/:id/settings/signature",
  ...write,
  ctrl.idValidators,
  validate,
  uploadSignature,
  ctrl.uploadSignatureHandler,
);
router.delete(
  "/:id/settings/signature",
  ...write,
  ctrl.idValidators,
  validate,
  ctrl.removeSignature,
);

// Bank accounts
router.get("/:id/banks", ...read, ctrl.idValidators, validate, ctrl.listBanks);
router.post(
  "/:id/banks",
  ...write,
  ctrl.bankCreateValidators,
  validate,
  ctrl.createBank,
);
router.patch(
  "/:id/banks/:bankId",
  ...write,
  ctrl.bankUpdateValidators,
  validate,
  ctrl.updateBank,
);
router.patch(
  "/:id/banks/:bankId/default",
  ...write,
  ctrl.bankIdValidators,
  validate,
  ctrl.makeDefaultBank,
);
router.delete(
  "/:id/banks/:bankId",
  ...write,
  ctrl.bankIdValidators,
  validate,
  ctrl.deleteBank,
);

router.patch(
  "/:id/banks/tally/:tallyExternalId",
  ...write,
  validate,
  ctrl.updateTallyBankLedger,
);

module.exports = router;
