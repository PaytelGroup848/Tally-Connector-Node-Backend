const express = require('express');
const validate = require('../middlewares/validate.middleware');
const otpRateLimit = require('../middlewares/otpRateLimit.middleware');
const superAdminAuth = require('../middlewares/superAdminAuth.middleware');
const ctrl = require('../controllers/superAdmin.controller');

const router = express.Router();

router.post('/auth/send-otp', otpRateLimit, ctrl.sendOtpValidators, validate, ctrl.sendOtp);
router.post(
  '/auth/verify-otp',
  otpRateLimit,
  ctrl.verifyOtpValidators,
  validate,
  ctrl.verifyOtpHandler
);

router.get('/organizations', superAdminAuth, ctrl.listOrganizations);
router.get('/organizations/:id', superAdminAuth, ctrl.getOrganization);
router.post(
  '/subscriptions/manual',
  superAdminAuth,
  ctrl.manualValidators,
  validate,
  ctrl.createManual
);
router.patch(
  '/subscriptions/:id',
  superAdminAuth,
  ctrl.patchValidators,
  validate,
  ctrl.patchSubscription
);
router.get('/subscriptions/:id/history', superAdminAuth, ctrl.subscriptionHistory);
router.get('/plans', superAdminAuth, ctrl.listPlans);
router.post('/plans', superAdminAuth, ctrl.planBodyValidators, validate, ctrl.createPlan);
router.patch('/plans/:id', superAdminAuth, ctrl.patchPlan);
router.get('/connectors', superAdminAuth, ctrl.listConnectors);

router.get("/users", superAdminAuth, ctrl.listUsers);
router.patch(
  "/users/:id/suspend",
  superAdminAuth,
  ctrl.suspendUserValidators,
  validate,
  ctrl.toggleUserSuspend,
);

router.get(
  "/users/:id/companies",
  superAdminAuth,
  ctrl.listUserCompaniesValidators,
  validate,
  ctrl.listUserCompanies,
);
router.patch(
  "/users/:id/companies",
  superAdminAuth,
  ctrl.assignCompaniesValidators,
  validate,
  ctrl.assignCompanies,
);


router.post(
  "/users",
  superAdminAuth,
  ctrl.createUserValidators,
  validate,
  ctrl.createUser,
);

module.exports = router;
