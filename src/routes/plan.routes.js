const express = require('express');
const { listPublicPlans } = require('../controllers/plan.controller');

const router = express.Router();
router.get('/', listPublicPlans);

module.exports = router;
