const express = require("express");

const webAuth = require("../middlewares/webAuth.middleware");

const { getMine } = require("../controllers/subscription.controller");

const {
  listInvoices,
  getInvoice,
} = require("../controllers/invoice.controller");

const router = express.Router();

router.get("/subscription/me", webAuth, getMine);

router.get("/invoices", webAuth, listInvoices);

router.get("/invoices/:invoiceId", webAuth, getInvoice);

module.exports = router;
