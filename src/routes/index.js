const express = require("express");

const authRoutes = require("./auth.routes");
const connectorAuthRoutes = require("./connectorAuth.routes");
const paymentRoutes = require("./payment.routes");
const planRoutes = require("./plan.routes");
const subscriptionRoutes = require("./subscription.routes");
const organizationRoutes = require("./organization.routes");
const memberRoutes = require("./member.routes");
const companyRoutes = require("./company.routes");
const connectorRoutes = require("./connector.routes");
const syncRoutes = require("./sync.routes");
const commandRoutes = require("./command.routes");
const dataRoutes = require("./data.routes");
const superAdminRoutes = require("./superAdmin.routes");
const webAuth = require("../middlewares/webAuth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../constants/permissions");
const { webStatus } = require("../controllers/connector.controller");
const billingRoutes = require("./billing.routes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ success: true, message: "ok" });
});

router.use("/auth", authRoutes);
router.use("/connector/auth", connectorAuthRoutes);
router.use("/payments", paymentRoutes);
router.use("/plans", planRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/organizations", organizationRoutes);
router.use("/members", memberRoutes);
router.use("/companies", companyRoutes);
router.use("/companies", dataRoutes);
router.get(
  "/connectors/status",
  webAuth,
  requirePermission(PERMISSIONS.CONNECTOR_STATUS),
  webStatus,
);
router.use("/connector/sync", syncRoutes);
router.use("/", commandRoutes);
router.use("/connector", connectorRoutes);
router.use("/super-admin", superAdminRoutes);

router.use("/reminder-template", require("./reminderTemplate.routes"));
router.use("/companies", require("./reminder.routes"));

router.use("/billing", billingRoutes);

router.use("/companies", require("./ewayBill.routes"));
router.use("/gsp-settings", require("./gspSettings.routes"));

module.exports = router;
