const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { send } = require("../utils/ApiResponse");

const Invoice = require("../models/Invoice");
const { generateInvoicePdf } = require("../services/invoicePdf.service");

const listInvoices = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    throw new ApiError(404, "Organization not found");
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);

  const skip = (page - 1) * limit;

  const filter = {
    organizationId: req.organizationId,
  };

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .select(
        "_id invoiceNumber invoiceDate billingDate renewalDate service status subtotal gstAmount totalAmount currency payment",
      )
      .sort({ invoiceDate: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Invoice.countDocuments(filter),
  ]);

  return send(
    res,
    200,
    {
      items,
      total,
      page,
      limit,
    },
    "Invoices",
  );
});

const getInvoice = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    throw new ApiError(404, "Organization not found");
  }

  const invoice = await Invoice.findOne({
    _id: req.params.invoiceId,
    organizationId: req.organizationId,
  }).lean();

  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  return send(res, 200, { invoice }, "Invoice");
});

const downloadInvoicePdf = asyncHandler(async (req, res) => {
  if (!req.organizationId) {
    throw new ApiError(404, "Organization not found");
  }

  const invoice = await Invoice.findOne({
    _id: req.params.invoiceId,
    organizationId: req.organizationId,
  }).lean();

  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  const pdfBuffer = await generateInvoicePdf(invoice);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${invoice.invoiceNumber}.pdf"`,
  );
  res.setHeader("Content-Length", pdfBuffer.length);
  return res.end(pdfBuffer);
});

module.exports = {
  listInvoices,
  getInvoice,
  downloadInvoicePdf,
};
