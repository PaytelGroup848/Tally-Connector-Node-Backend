const express = require('express');
const validate = require('../middlewares/validate.middleware');
const webAuth = require('../middlewares/webAuth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const ctrl = require('../controllers/organization.controller');

const router = express.Router();

router.get('/me', webAuth, ctrl.getMe);
router.patch(
  '/me',
  webAuth,
  requirePermission(PERMISSIONS.ORG_UPDATE),
  ctrl.updateValidators,
  validate,
  ctrl.updateMe
);

module.exports = router;
