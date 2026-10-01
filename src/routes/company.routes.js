const express = require("express");
const webAuth = require("../middlewares/webAuth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { PERMISSIONS } = require("../constants/permissions");
const companyAccessGuard = require("../middlewares/companyAccess.middleware");
const ctrl = require("../controllers/company.controller");

const router = express.Router();

router.use(webAuth);
router.param("id", (req, res, next) => companyAccessGuard(req, res, next));

router.get("/", requirePermission(PERMISSIONS.COMPANY_READ), ctrl.list);
router.get("/:id", requirePermission(PERMISSIONS.COMPANY_READ), ctrl.getById);

module.exports = router;
