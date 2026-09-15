const express = require('express');
const validate = require('../middlewares/validate.middleware');
const webAuth = require('../middlewares/webAuth.middleware');
const connectorAuth = require('../middlewares/connectorAuth.middleware');
const { requirePermission, requireActiveSubscription } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const ctrl = require('../controllers/command.controller');

const router = express.Router();

router.post(
  '/companies/:id/commands',
  webAuth,
  requirePermission(PERMISSIONS.COMMAND_CREATE),
  ctrl.createValidators,
  validate,
  ctrl.create  
);
router.get(
  '/companies/:id/commands',
  webAuth,
  requirePermission(PERMISSIONS.COMMAND_CREATE),
  ctrl.list
);
router.delete(
  '/companies/:id/commands/:commandId',
  webAuth,
  requirePermission(PERMISSIONS.COMMAND_CREATE),
  ctrl.cancel
);
router.get('/commands/:id', webAuth, requireActiveSubscription, ctrl.getById);

router.get('/connector/commands', connectorAuth, requireActiveSubscription, ctrl.poll);
router.post(
  '/connector/commands/:commandId/result',
  connectorAuth,
  requireActiveSubscription,
  ctrl.resultValidators,
  validate,
  ctrl.submitResult
);

module.exports = router;
