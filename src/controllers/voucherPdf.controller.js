const { param } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const Company = require("../models/Company");
const Voucher = require("../models/Voucher");
const VoucherLine = require("../models/VoucherLine");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const CompanyProfile = require("../models/CompanyProfile");
const CompanyBankAccount = require("../models/CompanyBankAccount");
const {
  buildVoucherViewModel,
  SUPPLIER_SIDE_TYPES,
} = require("../services/pdf/voucherViewModel");
const {
  buildHtml,
  buildFooterHtml,
} = require("../services/pdf/voucherPdfTemplate");
const { renderPdf } = require("../services/pdf/pdfRenderer.service");

// Safety cap so one absurd voucher cannot tie up Chromium for minutes.
const MAX_LINE_ITEMS = 3000;

const voucherPdfValidators = [
  param("id").isMongoId(),
  param("voucherId").isMongoId(),
];

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Exact match first (uses the {org, company, name} index); case-insensitive only as a fallback.
const findParty = async (scope, name, preferSupplier) => {
  if (!name) return null;
  const models = preferSupplier ? [Supplier, Customer] : [Customer, Supplier];

  for (const Model of models) {
    const exact = await Model.findOne({ ...scope, name }).lean();
    if (exact) return exact;
  }
  const ci = new RegExp(`^${escapeRegex(name.trim())}$`, "i");
  for (const Model of models) {
    const found = await Model.findOne({ ...scope, name: ci }).lean();
    if (found) return found;
  }
  return null;
};

const downloadVoucherPdf = asyncHandler(async (req, res) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  })
    .select("tallyCompanyName")
    .lean();
  if (!company)
    throw new ApiError(404, "Company not found", ERROR_CODES.NOT_FOUND);

  const scope = { organizationId: req.organizationId, companyId: company._id };

  const voucher = await Voucher.findOne({
    ...scope,
    _id: req.params.voucherId,
  }).lean();
  if (!voucher)
    throw new ApiError(404, "Voucher not found", ERROR_CODES.NOT_FOUND);

  const typeKey = String(voucher.voucherType || "")
    .trim()
    .toLowerCase();

  const [profile, bank, lines, party] = await Promise.all([
    CompanyProfile.findOne(scope).lean(),
    CompanyBankAccount.findOne(scope)
      .sort({ isDefault: -1, createdAt: 1 })
      .lean(),
    VoucherLine.find({ ...scope, voucherId: voucher._id }).lean(),
    findParty(
      scope,
      voucher.partyLedger,
      SUPPLIER_SIDE_TYPES.includes(typeKey),
    ),
  ]);

  const viewModel = await buildVoucherViewModel({
    company,
    voucher,
    lines,
    profile,
    bank,
    party,
  });

  if (
    viewModel.items.length > MAX_LINE_ITEMS ||
    viewModel.entries.length > MAX_LINE_ITEMS
  ) {
    throw new ApiError(
      422,
      `This voucher has too many lines to render as a PDF (limit ${MAX_LINE_ITEMS})`,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const pdf = await renderPdf({
    html: buildHtml(viewModel),
    footerHtml: buildFooterHtml(viewModel),
  });

  const fileName = `${viewModel.docTitle}-${viewModel.number || voucher._id}`
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
    "Content-Length": pdf.length,
    "Cache-Control": "private, no-store",
  });
  return res.send(pdf);
});


const previewVoucherHtml = asyncHandler(async (req, res) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  })
    .select("tallyCompanyName")
    .lean();
  if (!company)
    throw new ApiError(404, "Company not found", ERROR_CODES.NOT_FOUND);

  const scope = { organizationId: req.organizationId, companyId: company._id };

  const voucher = await Voucher.findOne({
    ...scope,
    _id: req.params.voucherId,
  }).lean();
  if (!voucher)
    throw new ApiError(404, "Voucher not found", ERROR_CODES.NOT_FOUND);

  const typeKey = String(voucher.voucherType || "")
    .trim()
    .toLowerCase();

  const [profile, bank, lines, party] = await Promise.all([
    CompanyProfile.findOne(scope).lean(),
    CompanyBankAccount.findOne(scope)
      .sort({ isDefault: -1, createdAt: 1 })
      .lean(),
    VoucherLine.find({ ...scope, voucherId: voucher._id }).lean(),
    findParty(
      scope,
      voucher.partyLedger,
      SUPPLIER_SIDE_TYPES.includes(typeKey),
    ),
  ]);

  const viewModel = await buildVoucherViewModel({
    company,
    voucher,
    lines,
    profile,
    bank,
    party,
  });

  if (
    viewModel.items.length > MAX_LINE_ITEMS ||
    viewModel.entries.length > MAX_LINE_ITEMS
  ) {
    throw new ApiError(
      422,
      `This voucher has too many lines to preview (limit ${MAX_LINE_ITEMS})`,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

 
  const html = buildHtml(viewModel);

  res.set({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
  });
  return res.send(html);
});

module.exports = { downloadVoucherPdf, previewVoucherHtml, voucherPdfValidators };
