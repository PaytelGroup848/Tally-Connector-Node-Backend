const express = require('express');
const validate = require('../middlewares/validate.middleware');
const connectorAuth = require('../middlewares/connectorAuth.middleware');
const { requireActiveSubscription } = require('../middlewares/rbac.middleware');
const ctrl = require('../controllers/sync.controller');

const router = express.Router();

router.use(connectorAuth, requireActiveSubscription);

router.post('/start', ctrl.startValidators, validate, ctrl.start);
router.post('/batch', ctrl.batchValidators, validate, ctrl.batch);
router.post('/complete', ctrl.completeValidators, validate, ctrl.complete);

module.exports = router;
