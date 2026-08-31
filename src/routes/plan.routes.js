const express = require("express");
const {
  listPublicPlans,
  createPlan,
} = require("../controllers/plan.controller");

const router = express.Router();
router.get("/", listPublicPlans);
router.post("/", createPlan);

module.exports = router;
