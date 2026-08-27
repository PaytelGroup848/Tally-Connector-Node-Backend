const express = require('express');
const validate = require('../middlewares/validate.middleware');
const otpRateLimit = require('../middlewares/otpRateLimit.middleware');
const webAuth = require('../middlewares/webAuth.middleware');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

router.post('/send-otp', otpRateLimit, ctrl.sendOtpValidators, validate, ctrl.sendOtp);
router.post('/verify-otp', otpRateLimit, ctrl.verifyOtpValidators, validate, ctrl.verifyOtpHandler);
router.post('/logout', webAuth, ctrl.logout);

module.exports = router;
