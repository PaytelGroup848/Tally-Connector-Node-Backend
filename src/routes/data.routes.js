const express = require("express");
const webAuth = require("../middlewares/webAuth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../constants/permissions");
const ctrl = require("../controllers/data.controller");

const router = express.Router();

router.use(webAuth);

router.get(
  "/:id/ledgers",
  requirePermission(PERMISSIONS.LEDGER_READ),
  ctrl.listLedgers,
);

router.get(
  "/:id/voucher-types",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listVoucherTypes,
);

router.get(
  "/:id/godowns",
  requirePermission(PERMISSIONS.STOCK_READ),
  ctrl.listGodowns,
);

router.get(
  "/:id/orders",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listOrders,
);
router.get(
  "/:id/customers",
  requirePermission(PERMISSIONS.CUSTOMER_READ),
  ctrl.listCustomers,
);
router.get(
  "/:id/suppliers",
  requirePermission(PERMISSIONS.SUPPLIER_READ),
  ctrl.listSuppliers,
);
router.get(
  "/:id/stock",
  requirePermission(PERMISSIONS.STOCK_READ),
  ctrl.listStock,
);
router.get(
  "/:id/vouchers",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listVouchers,
);
router.get(
  "/:id/sales",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listSales,
);

router.get(
  "/:id/credit-notes",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listCreditNotes,
);

router.get(
  "/:id/receipts",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listReceipts,
);

router.get(
  "/:id/sales-orders",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listSalesOrders,
);

router.get(
  "/:id/delivery-notes",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listDeliveryNotes,
);

router.get(
  "/:id/purchases",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listPurchases,
);

router.get(
  "/:id/debit-notes",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listDebitNotes,
);

router.get(
  "/:id/payments",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listPayments,
);

router.get(
  "/:id/purchase-orders",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listPurchaseOrders,
);

router.get(
  "/:id/receipt-notes",
  requirePermission(PERMISSIONS.VOUCHER_READ),
  ctrl.listReceiptNotes,
);

router.get(
  "/:id/cash",
  requirePermission(PERMISSIONS.LEDGER_READ),
  ctrl.listCashLedgers,
);

router.get(
  "/:id/bank",
  requirePermission(PERMISSIONS.LEDGER_READ),
  ctrl.listBankLedgers,
);

router.get(
  "/:id/parties",
  requirePermission(PERMISSIONS.CUSTOMER_READ),
  ctrl.listParties,
);

router.get(
  "/:id/reports/:reportType",
  requirePermission(PERMISSIONS.REPORTS_READ),
  ctrl.report,
);

module.exports = router;
