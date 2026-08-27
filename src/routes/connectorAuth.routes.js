const express = require('express');
const validate = require('../middlewares/validate.middleware');
const otpRateLimit = require('../middlewares/otpRateLimit.middleware');
const connectorAuth = require('../middlewares/connectorAuth.middleware');
const ctrl = require('../controllers/connectorAuth.controller');

const router = express.Router();

router.post('/send-otp', otpRateLimit, ctrl.sendOtpValidators, validate, ctrl.sendOtp);
router.post('/verify-otp', otpRateLimit, ctrl.verifyOtpValidators, validate, ctrl.verifyOtpHandler);
router.post('/refresh', ctrl.refreshValidators, validate, ctrl.refresh);
router.post('/logout', connectorAuth, ctrl.logout);

module.exports = router;
