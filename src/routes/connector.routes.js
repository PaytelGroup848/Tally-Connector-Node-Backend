const express = require('express');
const validate = require('../middlewares/validate.middleware');
const connectorAuth = require('../middlewares/connectorAuth.middleware');
const { requireActiveSubscription } = require('../middlewares/rbac.middleware');
const ctrl = require('../controllers/connector.controller');

const router = express.Router();

router.get('/me', connectorAuth, requireActiveSubscription, ctrl.me);
router.get('/companies', connectorAuth, requireActiveSubscription, ctrl.listCompanies);
router.post(
  '/company/link',
  connectorAuth,
  requireActiveSubscription,
  ctrl.linkValidators,
  validate,
  ctrl.linkCompany
);
router.post(
  '/heartbeat',
  connectorAuth,
  ctrl.heartbeatValidators,
  validate,
  ctrl.heartbeat
);
router.get('/config', connectorAuth, requireActiveSubscription, ctrl.config);
router.get('/version', connectorAuth, ctrl.version);

module.exports = router;
