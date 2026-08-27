const express = require('express');
const webAuth = require('../middlewares/webAuth.middleware');
const { getMine } = require('../controllers/subscription.controller');

const router = express.Router();
router.get('/me', webAuth, getMine);

module.exports = router;
