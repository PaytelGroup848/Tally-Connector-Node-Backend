const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');
const Company = require('../models/Company');
const Ledger = require('../models/Ledger');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const StockBalance = require('../models/StockBalance');
const Voucher = require('../models/Voucher');
const VoucherLine = require('../models/VoucherLine');

const scopedCompany = async (req) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  });
  if (!company) throw new ApiError(404, 'Company not found', ERROR_CODES.NOT_FOUND);
  return company;
};

const paginate = (req) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const listLedgers = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);
  const filter = {
    organizationId: req.organizationId,
    companyId: company._id,
  };
  if (req.query.q) filter.name = new RegExp(req.query.q, 'i');
  const [items, total] = await Promise.all([
    Ledger.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Ledger.countDocuments(filter),
  ]);
  return send(res, 200, { items, total, page, limit }, 'Ledgers');
});

const listCustomers = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);
  const filter = { organizationId: req.organizationId, companyId: company._id };
  if (req.query.q) filter.name = new RegExp(req.query.q, 'i');
  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  return send(res, 200, { items, total, page, limit }, 'Customers');
});

const listSuppliers = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);
  const filter = { organizationId: req.organizationId, companyId: company._id };
  if (req.query.q) filter.name = new RegExp(req.query.q, 'i');
  const [items, total] = await Promise.all([
    Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Supplier.countDocuments(filter),
  ]);
  return send(res, 200, { items, total, page, limit }, 'Suppliers');
});

const listStock = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);
  const filter = { organizationId: req.organizationId, companyId: company._id };
  if (req.query.q) filter.itemName = new RegExp(req.query.q, 'i');
  const [items, total] = await Promise.all([
    StockBalance.find(filter).sort({ itemName: 1 }).skip(skip).limit(limit),
    StockBalance.countDocuments(filter),
  ]);
  return send(res, 200, { items, total, page, limit }, 'Stock');
});

const listVouchers = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);
  const filter = { organizationId: req.organizationId, companyId: company._id };
  if (req.query.voucherType) filter.voucherType = req.query.voucherType;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }
  const [items, total] = await Promise.all([
    Voucher.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    Voucher.countDocuments(filter),
  ]);
  return send(res, 200, { items, total, page, limit }, 'Vouchers');
});

const report = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const type = req.params.reportType;
  const scope = { organizationId: req.organizationId, companyId: company._id };

  if (type === 'trial-balance') {
    const ledgers = await Ledger.find(scope).select('name group ledgerType openingBalance closingBalance');
    return send(res, 200, { reportType: type, ledgers }, 'Trial balance');
  }

  if (type === 'day-book') {
    const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const vouchers = await Voucher.find({ ...scope, date: { $gte: from, $lte: to } }).sort({ date: 1 });
    return send(res, 200, { reportType: type, from, to, vouchers }, 'Day book');
  }

  if (type === 'pnl') {
    const ledgers = await Ledger.find({
      ...scope,
      ledgerType: { $in: ['income', 'expense', 'INCOME', 'EXPENSE'] },
    });
    const income = ledgers
      .filter((l) => String(l.ledgerType).toLowerCase() === 'income')
      .reduce((s, l) => s + (l.closingBalance || 0), 0);
    const expense = ledgers
      .filter((l) => String(l.ledgerType).toLowerCase() === 'expense')
      .reduce((s, l) => s + (l.closingBalance || 0), 0);
    return send(res, 200, { reportType: type, income, expense, net: income - expense, ledgers }, 'P&L');
  }

  if (type === 'balance-sheet') {
    const ledgers = await Ledger.find({
      ...scope,
      ledgerType: { $in: ['asset', 'liability', 'ASSET', 'LIABILITY'] },
    });
    return send(res, 200, { reportType: type, ledgers }, 'Balance sheet');
  }

  if (type === 'voucher-lines') {
    const voucherId = req.query.voucherId;
    if (!voucherId) throw new ApiError(400, 'voucherId query is required', ERROR_CODES.VALIDATION_ERROR);
    const lines = await VoucherLine.find({ ...scope, voucherId });
    return send(res, 200, { reportType: type, lines }, 'Voucher lines');
  }

  throw new ApiError(404, 'Unknown report type', ERROR_CODES.NOT_FOUND);
});

module.exports = {
  listLedgers,
  listCustomers,
  listSuppliers,
  listStock,
  listVouchers,
  report,
};
