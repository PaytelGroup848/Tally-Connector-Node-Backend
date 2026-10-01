const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const Company = require("../models/Company");
const Voucher = require("../models/Voucher");
const Customer = require("../models/Customer");
const Ledger = require("../models/Ledger");
const BillAllocation = require("../models/BillAllocation");

const scopedCompany = async (req) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  }).lean();
  if (!company)
    throw new ApiError(404, "Company not found", ERROR_CODES.NOT_FOUND);
  return company;
};

const RANGE_DAYS = { "7D": 7, "30D": 30, "3M": 90, "1Y": 365 };

const resolveRange = (req) => {
  const rangeKey = String(req.query.range || "30D").toUpperCase();
  const days = RANGE_DAYS[rangeKey] || 30;

  const to = req.query.to
    ? new Date(`${req.query.to}T23:59:59.999Z`)
    : new Date();
  const from = req.query.from
    ? new Date(`${req.query.from}T00:00:00.000Z`)
    : new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  // previous period of equal length, for % comparison
  const periodMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - periodMs);

  return { from, to, prevFrom, prevTo };
};

const pctChange = (current, previous) => {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const sumVoucherAmount = async (
  companyId,
  organizationId,
  voucherType,
  from,
  to,
) => {
  const result = await Voucher.aggregate([
    {
      $match: {
        organizationId,
        companyId,
        voucherType,
        date: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
  ]);
  return result[0]?.total || 0;
};

const getDashboard = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { from, to, prevFrom, prevTo } = resolveRange(req);
  const scope = { organizationId: req.organizationId, companyId: company._id };

  // ---- 1. Summary cards: Sales / Receipts / Payments (current vs previous period) ----
  const [
    salesNow,
    salesPrev,
    receiptsNow,
    receiptsPrev,
    paymentsNow,
    paymentsPrev,
  ] = await Promise.all([
    sumVoucherAmount(company._id, req.organizationId, "Sales", from, to),
    sumVoucherAmount(
      company._id,
      req.organizationId,
      "Sales",
      prevFrom,
      prevTo,
    ),
    sumVoucherAmount(company._id, req.organizationId, "Receipt", from, to),
    sumVoucherAmount(
      company._id,
      req.organizationId,
      "Receipt",
      prevFrom,
      prevTo,
    ),
    sumVoucherAmount(company._id, req.organizationId, "Payment", from, to),
    sumVoucherAmount(
      company._id,
      req.organizationId,
      "Payment",
      prevFrom,
      prevTo,
    ),
  ]);

  // ---- 2. Cash & Bank Balance (current snapshot, no historical % available) ----
  const cashBankAgg = await Ledger.aggregate([
    {
      $match: {
        ...scope,
        $or: [
          { group: { $in: ["Cash-in-hand", "Bank Accounts"] } },
          { parent: { $in: ["Cash-in-hand", "Bank Accounts"] } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ["$closingBalance", 0] } },
      },
    },
  ]);
  const cashBankBalance = cashBankAgg[0]?.total || 0;

  // ---- 3. Sales & Receipts chart (daily buckets within range) ----
  const chartAgg = await Voucher.aggregate([
    {
      $match: {
        ...scope,
        voucherType: { $in: ["Sales", "Receipt"] },
        date: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          type: "$voucherType",
        },
        total: { $sum: { $ifNull: ["$amount", 0] } },
      },
    },
    { $sort: { "_id.day": 1 } },
  ]);
  const chartMap = {};
  for (const row of chartAgg) {
    const day = row._id.day;
    if (!chartMap[day]) chartMap[day] = { date: day, sales: 0, receipts: 0 };
    if (row._id.type === "Sales") chartMap[day].sales = row.total;
    if (row._id.type === "Receipt") chartMap[day].receipts = row.total;
  }
  const chart = Object.values(chartMap);

  // ---- 4. Receivables aging (exact, bill-wise) ----
  const billAgg = await BillAllocation.aggregate([
    { $match: scope },
    {
      $group: {
        _id: {
          partyLedger: "$partyLedger",
          billName: "$billName",
        },
        outstanding: { $sum: "$amount" },
        dueDate: { $max: "$dueDate" },
        voucherDate: { $max: "$voucherDate" },
      },
    },
    {
      $match: {
        outstanding: { $gt: 0 },
      },
    },
  ]);

  const buckets = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "91-120": 0,
    ">120": 0,
  };

  const now = new Date();
  const perCustomer = {};

  for (const bill of billAgg) {
    const { partyLedger } = bill._id;

    const refDate = bill.dueDate || bill.voucherDate;

    const ageDays = refDate
      ? Math.floor((now - new Date(refDate)) / (1000 * 60 * 60 * 24))
      : 0;

    if (ageDays <= 30) {
      buckets["0-30"] += bill.outstanding;
    } else if (ageDays <= 60) {
      buckets["31-60"] += bill.outstanding;
    } else if (ageDays <= 90) {
      buckets["61-90"] += bill.outstanding;
    } else if (ageDays <= 120) {
      buckets["91-120"] += bill.outstanding;
    } else {
      buckets[">120"] += bill.outstanding;
    }

    if (!perCustomer[partyLedger]) {
      perCustomer[partyLedger] = {
        outstanding: 0,
        oldestRefDate: refDate,
      };
    }

    perCustomer[partyLedger].outstanding += bill.outstanding;

    if (
      refDate &&
      (!perCustomer[partyLedger].oldestRefDate ||
        refDate < perCustomer[partyLedger].oldestRefDate)
    ) {
      perCustomer[partyLedger].oldestRefDate = refDate;
    }
  }

  const totalOutstanding = Object.values(buckets).reduce((a, b) => a + b, 0);

  const totalCustomers = await Customer.countDocuments(scope);

  const activeCustomerNames = await Voucher.distinct("partyLedger", {
    ...scope,
    voucherType: "Sales",
    date: { $gte: from, $lte: to },
  });

  const activeCustomers = activeCustomerNames.filter(Boolean).length;

  const overdueCustomers = Object.values(perCustomer).filter((customer) => {
    const age = customer.oldestRefDate
      ? Math.floor(
          (now - new Date(customer.oldestRefDate)) / (1000 * 60 * 60 * 24),
        )
      : 0;

    return age > 30;
  }).length;

  // ---- 6. Top Customers table (sales + receipts per customer within period) ----
  const salesByCustomer = await Voucher.aggregate([
    {
      $match: {
        ...scope,
        voucherType: "Sales",
        date: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: "$partyLedger",
        sales: {
          $sum: {
            $ifNull: ["$amount", 0],
          },
        },
      },
    },
  ]);

  const receiptsByCustomer = await Voucher.aggregate([
    {
      $match: {
        ...scope,
        voucherType: "Receipt",
        date: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: "$partyLedger",
        receipts: {
          $sum: {
            $ifNull: ["$amount", 0],
          },
        },
      },
    },
  ]);

  const salesMap = Object.fromEntries(
    salesByCustomer.map((r) => [r._id, r.sales]),
  );

  const receiptsMap = Object.fromEntries(
    receiptsByCustomer.map((r) => [r._id, r.receipts]),
  );

  const topCustomers = Object.entries(perCustomer)
    .map(([name, data]) => ({
      name,
      sales: salesMap[name] || 0,
      receipts: receiptsMap[name] || 0,
      outstanding: data.outstanding,
      days: data.oldestRefDate
        ? Math.floor(
            (now - new Date(data.oldestRefDate)) / (1000 * 60 * 60 * 24),
          )
        : 0,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  // ---- 7. Day Book (recent entries snapshot) ----
  const statusMap = {
    Sales: "Posted",
    Purchase: "Posted",
    Receipt: "Received",
    Payment: "Paid",
  };
  const recentVouchers = await Voucher.find({
    ...scope,
    date: { $gte: from, $lte: to },
  })
    .select("date partyLedger voucherType voucherNumber amount")
    .sort({ date: -1, _id: -1 })
    .limit(5)
    .lean();
  const dayBook = recentVouchers.map((v) => ({
    date: v.date,
    particulars: v.voucherNumber
      ? `${v.voucherType} #${v.voucherNumber}`
      : v.partyLedger,
    type: v.voucherType,
    amount: v.amount,
    status: statusMap[v.voucherType] || v.voucherType,
  }));

  return send(
    res,
    200,
    {
      range: { from, to },
      summary: {
        totalSales: {
          value: salesNow,
          changePercent: pctChange(salesNow, salesPrev),
        },
        totalReceipts: {
          value: receiptsNow,
          changePercent: pctChange(receiptsNow, receiptsPrev),
        },
        totalPayments: {
          value: paymentsNow,
          changePercent: pctChange(paymentsNow, paymentsPrev),
        },
        cashBankBalance: { value: cashBankBalance, changePercent: null }, // no historical snapshot
      },
      chart,
      receivables: {
        totalOutstanding,
        buckets,
        totalCustomers,
        activeCustomers,
        overdueCustomers,
      },
      topCustomers,
      dayBook,
    },
    "Dashboard",
  );
});

module.exports = { getDashboard };
