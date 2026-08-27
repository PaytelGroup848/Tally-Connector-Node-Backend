const express = require('express');
const validate = require('../middlewares/validate.middleware');
const webAuth = require('../middlewares/webAuth.middleware');
const { requireRolePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const ctrl = require('../controllers/payment.controller');

const router = express.Router();

router.post(
  '/create-order',
  webAuth,
  requireRolePermission(PERMISSIONS.PAYMENT_CREATE),
  ctrl.createOrderValidators,
  validate,
  ctrl.createOrderHandler
);
router.post(
  '/verify',
  webAuth,
  requireRolePermission(PERMISSIONS.PAYMENT_CREATE),
  ctrl.verifyValidators,
  validate,
  ctrl.verifyHandler
);

module.exports = router;
