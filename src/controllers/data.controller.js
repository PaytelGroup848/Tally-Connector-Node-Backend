const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const Company = require("../models/Company");
const Ledger = require("../models/Ledger");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const StockBalance = require("../models/StockBalance");
const Voucher = require("../models/Voucher");
const VoucherLine = require("../models/VoucherLine");
const { default: mongoose } = require("mongoose");

const scopedCompany = async (req) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  });
  if (!company)
    throw new ApiError(404, "Company not found", ERROR_CODES.NOT_FOUND);
  return company;
};

const paginate = (req) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const escapeRegex = (value = "") => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getSearchRegex = (value) => {
  if (!value || !String(value).trim()) return null;

  return new RegExp(escapeRegex(String(value).trim()), "i");
};

const getDateRange = (req) => {
  let from;
  let to;

  if (req.query.from) {
    from = new Date(`${req.query.from}T00:00:00.000Z`);

    if (Number.isNaN(from.getTime())) {
      throw new ApiError(
        400,
        "Invalid from date",
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
  }

  if (req.query.to) {
    to = new Date(`${req.query.to}T23:59:59.999Z`);

    if (Number.isNaN(to.getTime())) {
      throw new ApiError(400, "Invalid to date", ERROR_CODES.VALIDATION_ERROR);
    }
  }

  if (from && to && from > to) {
    throw new ApiError(
      400,
      "from date cannot be greater than to date",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  return { from, to };
};

const listLedgers = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);
  const filter = {
    organizationId: req.organizationId,
    companyId: company._id,
  };
  if (req.query.q) filter.name = new RegExp(req.query.q, "i");
  const [items, total] = await Promise.all([
    Ledger.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Ledger.countDocuments(filter),
  ]);
  return send(res, 200, { items, total, page, limit }, "Ledgers");
});

const listCustomers = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);
  const filter = { organizationId: req.organizationId, companyId: company._id };
  if (req.query.q) filter.name = new RegExp(req.query.q, "i");
  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  return send(res, 200, { items, total, page, limit }, "Customers");
});

const listSuppliers = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);
  const filter = { organizationId: req.organizationId, companyId: company._id };
  if (req.query.q) filter.name = new RegExp(req.query.q, "i");
  const [items, total] = await Promise.all([
    Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Supplier.countDocuments(filter),
  ]);
  return send(res, 200, { items, total, page, limit }, "Suppliers");
});

const listStock = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);
  const filter = { organizationId: req.organizationId, companyId: company._id };
  if (req.query.q) filter.itemName = new RegExp(req.query.q, "i");
  const [items, total] = await Promise.all([
    StockBalance.find(filter).sort({ itemName: 1 }).skip(skip).limit(limit),
    StockBalance.countDocuments(filter),
  ]);
  return send(res, 200, { items, total, page, limit }, "Stock");
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
  return send(res, 200, { items, total, page, limit }, "Vouchers");
});

const listVoucherTypes = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);

  const items = await Voucher.distinct("voucherType", {
    organizationId: req.organizationId,
    companyId: company._id,
    voucherType: {
      $exists: true,
      $nin: ["", null],
    },
  });

  items.sort((a, b) => String(a).localeCompare(String(b)));

  return send(
    res,
    200,
    {
      items: items.map((name) => ({
        name,
      })),
      total: items.length,
    },
    "Voucher types",
  );
});

const listGodowns = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);

  const godowns = await StockBalance.distinct("godown", {
    organizationId: req.organizationId,
    companyId: company._id,
    godown: {
      $exists: true,
      $nin: ["", null],
    },
  });

  const items = godowns
    .filter((name) => String(name).trim())
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map((name) => ({
      name: String(name).trim(),
    }));

  return send(
    res,
    200,
    {
      items,
      total: items.length,
    },
    "Godowns",
  );
});

const listOrders = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);

  const { page, limit, skip } = paginate(req);

  const filter = {
    organizationId: req.organizationId,
    companyId: company._id,
    voucherType: "Sales Order",
  };

  if (req.query.q) {
    const regex = getSearchRegex(req.query.q);

    filter.$or = [{ voucherNumber: regex }, { partyLedger: regex }];
  }

  const [items, total] = await Promise.all([
    Voucher.find(filter)
      .select(
        "_id voucherNumber voucherType date partyLedger amount narration tallyExternalId",
      )
      .sort({ date: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Voucher.countDocuments(filter),
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
    "Orders",
  );
});

const listSales = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);

  const { page, limit, skip } = paginate(req);

  const filter = {
    organizationId: req.organizationId,
    companyId: company._id,
    voucherType: "Sales",
  };

  // Search by voucher number or party
  if (req.query.q) {
    const regex = getSearchRegex(req.query.q);

    filter.$or = [{ voucherNumber: regex }, { partyLedger: regex }];
  }

  // Date range
  if (req.query.from || req.query.to) {
    filter.date = {};

    if (req.query.from) {
      filter.date.$gte = new Date(`${req.query.from}T00:00:00.000Z`);
    }

    if (req.query.to) {
      const toDate = new Date(`${req.query.to}T23:59:59.999Z`);
      filter.date.$lte = toDate;
    }
  }

  const [items, total, totalAmountResult] = await Promise.all([
    Voucher.find(filter)
      .select(
        "_id tallyExternalId voucherType voucherNumber date partyLedger amount narration",
      )
      .sort({ date: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Voucher.countDocuments(filter),

    Voucher.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: {
            $sum: { $ifNull: ["$amount", 0] },
          },
        },
      },
    ]),
  ]);

  const totalAmount =
    totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

  return send(
    res,
    200,
    {
      items,
      total,
      page,
      limit,
      totalAmount,
    },
    "Sales",
  );
});

const report = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);

  const type = req.params.reportType;

  const scope = {
    organizationId: req.organizationId,
    companyId: company._id,
  };

  const { page, limit, skip } = paginate(req);

  const searchRegex = getSearchRegex(req.query.q);

  const { from, to } = getDateRange(req);

  if (type === "trial-balance") {
    const filter = {
      ...scope,
    };

    if (searchRegex) {
      filter.name = searchRegex;
    }

    if (req.query.group) {
      filter.group = req.query.group;
    }

    if (req.query.ledgerType) {
      filter.ledgerType = req.query.ledgerType;
    }

    const [items, total, totals] = await Promise.all([
      Ledger.find(filter)
        .select(
          "name group ledgerType openingBalance closingBalance tallyExternalId alterId",
        )
        .sort({ name: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Ledger.countDocuments(filter),

      Ledger.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: null,

            totalOpeningBalance: {
              $sum: {
                $ifNull: ["$openingBalance", 0],
              },
            },

            totalClosingBalance: {
              $sum: {
                $ifNull: ["$closingBalance", 0],
              },
            },
          },
        },
      ]),
    ]);

    const reportTotals = totals[0] || {
      totalOpeningBalance: 0,
      totalClosingBalance: 0,
    };

    return send(
      res,
      200,
      {
        reportType: type,
        items,
        total,
        page,
        limit,
        totalOpeningBalance: reportTotals.totalOpeningBalance,
        totalClosingBalance: reportTotals.totalClosingBalance,
      },
      "Trial balance",
    );
  }

  if (type === "day-book") {
    const filter = {
      ...scope,
    };

    if (from || to) {
      filter.date = {};

      if (from) {
        filter.date.$gte = from;
      }

      if (to) {
        filter.date.$lte = to;
      }
    }

    if (req.query.voucherType) {
      filter.voucherType = req.query.voucherType;
    }

    if (searchRegex) {
      filter.$or = [
        {
          voucherNumber: searchRegex,
        },
        {
          partyLedger: searchRegex,
        },
        {
          narration: searchRegex,
        },
        {
          voucherType: searchRegex,
        },
      ];
    }

    const [items, total] = await Promise.all([
      Voucher.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Voucher.countDocuments(filter),
    ]);

    return send(
      res,
      200,
      {
        reportType: type,
        from: from || null,
        to: to || null,
        items,
        total,
        page,
        limit,
      },
      "Day book",
    );
  }

  if (type === "pnl") {
    const filter = {
      ...scope,

      ledgerType: {
        $in: ["income", "expense", "INCOME", "EXPENSE"],
      },
    };

    if (searchRegex) {
      filter.name = searchRegex;
    }

    if (req.query.ledgerType) {
      const ledgerType = String(req.query.ledgerType).toLowerCase();

      if (!["income", "expense"].includes(ledgerType)) {
        throw new ApiError(
          400,
          "ledgerType must be income or expense",
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      filter.ledgerType = {
        $in: [ledgerType, ledgerType.toUpperCase()],
      };
    }

    const [items, total, totals] = await Promise.all([
      Ledger.find(filter)
        .select(
          "name group ledgerType openingBalance closingBalance tallyExternalId alterId",
        )
        .sort({ name: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Ledger.countDocuments(filter),

      Ledger.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: {
              $toLower: "$ledgerType",
            },

            amount: {
              $sum: {
                $ifNull: ["$closingBalance", 0],
              },
            },
          },
        },
      ]),
    ]);

    let income = 0;
    let expense = 0;

    for (const row of totals) {
      if (row._id === "income") {
        income += row.amount;
      }

      if (row._id === "expense") {
        expense += row.amount;
      }
    }

    return send(
      res,
      200,
      {
        reportType: type,
        income,
        expense,
        net: income - expense,
        items,
        total,
        page,
        limit,
      },
      "P&L",
    );
  }

  if (type === "balance-sheet") {
    const filter = {
      ...scope,

      ledgerType: {
        $in: ["asset", "liability", "ASSET", "LIABILITY"],
      },
    };

    if (searchRegex) {
      filter.name = searchRegex;
    }

    if (req.query.ledgerType) {
      const ledgerType = String(req.query.ledgerType).toLowerCase();

      if (!["asset", "liability"].includes(ledgerType)) {
        throw new ApiError(
          400,
          "ledgerType must be asset or liability",
          ERROR_CODES.VALIDATION_ERROR,
        );
      }

      filter.ledgerType = {
        $in: [ledgerType, ledgerType.toUpperCase()],
      };
    }

    const [items, total] = await Promise.all([
      Ledger.find(filter)
        .select(
          "name group ledgerType openingBalance closingBalance tallyExternalId alterId",
        )
        .sort({ ledgerType: 1, name: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Ledger.countDocuments(filter),
    ]);

    return send(
      res,
      200,
      {
        reportType: type,
        items,
        total,
        page,
        limit,
      },
      "Balance sheet",
    );
  }

  if (type === "voucher-lines") {
    const voucherId = String(req.query.voucherId || "").trim();

    if (!voucherId) {
      throw new ApiError(
        400,
        "voucherId query is required",
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    if (!mongoose.isValidObjectId(voucherId)) {
      throw new ApiError(
        400,
        "Invalid MongoDB voucherId",
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const voucher = await Voucher.findOne({
      _id: voucherId,
      ...scope,
    }).lean();

    if (!voucher) {
      throw new ApiError(404, "Voucher not found", ERROR_CODES.NOT_FOUND);
    }

    let lines = (voucher.ledgerEntries || []).map((line, index) => ({
      _id: `${voucher._id}-${index}`,
      voucherId: voucher._id,
      tallyExternalId: voucher.tallyExternalId,
      ledgerName: line.ledgerName || "",
      ledgerTallyExternalId: line.ledgerTallyExternalId || "",
      debit: Number(line.amount) < 0 ? Math.abs(Number(line.amount)) : 0,
      credit: Number(line.amount) > 0 ? Number(line.amount) : 0,
      amount: Number(line.amount) || 0,
      itemName: line.itemName || "",
      qty: Number(line.qty) || 0,
      rate: Number(line.rate) || 0,
      isDeemedPositive: line.isDeemedPositive ?? false,
      isPartyLedger: line.isPartyLedger ?? false,
      billAllocations: line.billAllocations || [],
      bankAllocations: line.bankAllocations || [],
      raw: line,
    }));

    if (searchRegex) {
      lines = lines.filter(
        (line) =>
          searchRegex.test(line.ledgerName) ||
          searchRegex.test(line.itemName) ||
          searchRegex.test(line.raw?.description || "") ||
          searchRegex.test(line.raw?.narration || ""),
      );
    }

    const total = lines.length;

    const items = lines.slice(skip, skip + limit);

    return send(
      res,
      200,
      {
        reportType: type,
        voucherId: String(voucher._id),
        items,
        total,
        page,
        limit,
      },
      "Voucher lines",
    );
  }

  throw new ApiError(404, "Unknown report type", ERROR_CODES.NOT_FOUND);
});

module.exports = {
  listLedgers,
  listCustomers,
  listSuppliers,
  listStock,
  listVouchers,
  report,
  listVoucherTypes,
  listGodowns,
  listOrders,
  listSales,
};
