const { body } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const Company = require("../models/Company");
const Voucher = require("../models/Voucher");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const EwayBill = require("../models/EwayBill");

const Command = require("../models/Command");
const { renderQrCodeImage } = require("../services/qrCode.service");
const clearTaxAdapter = require("../services/gspProvider/clearTaxAdapter");
const { logAudit } = require("../services/audit.service");
const OrganizationGspCredential = require("./OrganizationGspCredential");

const scopedCompany = async (req) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  }).lean();
  if (!company)
    throw new ApiError(404, "Company not found", ERROR_CODES.NOT_FOUND);
  return company;
};

const paginate = (req) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const getCredential = async (organizationId) => {
  const cred = await OrganizationGspCredential.findOne({
    organizationId,
    isActive: true,
  }).lean();
  if (!cred) {
    throw new ApiError(
      400,
      "GSP credentials are not configured for this organization",
      ERROR_CODES.GSP_CREDENTIALS_NOT_CONFIGURED,
    );
  }
  return {
    gstin: cred.gstin,
    username: OrganizationGspCredential.decrypt(cred.encryptedUsername),
    password: OrganizationGspCredential.decrypt(cred.encryptedPassword),
  };
};

// A voucher stores the party name as a plain string (partyLedger), not a
// reference — so the buyer's GSTIN has to be looked up from Customer/Supplier
// by matching that name. This is required because NIC's e-way bill schema
// mandates the recipient's GSTIN.
const findPartyGstin = async (organizationId, companyId, partyLedgerName) => {
  if (!partyLedgerName) return "";

  const nameRegex = new RegExp(`^${partyLedgerName.trim()}$`, "i");

  const customer = await Customer.findOne({
    organizationId,
    companyId,
    name: nameRegex,
  })
    .select("gstin")
    .lean();
  if (customer?.gstin) return customer.gstin;

  const supplier = await Supplier.findOne({
    organizationId,
    companyId,
    name: nameRegex,
  })
    .select("gstin")
    .lean();
  if (supplier?.gstin) return supplier.gstin;

  return "";
};

const generateValidators = [
  body("voucherId").isMongoId(),
  body("vehicleNumber").optional().isString(),
  body("transporterName").optional().isString(),
  body("transporterId").optional().isString(),
  body("transportMode").optional().isString(),
  body("distanceKm").optional().isNumeric(),
];

// ---- Generate ----
const generate = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const {
    voucherId,
    vehicleNumber = "",
    transporterName = "",
    transporterId = "",
    transportMode = "Road",
    distanceKm = 0,
  } = req.body;

  const voucher = await Voucher.findOne({
    _id: voucherId,
    organizationId: req.organizationId,
    companyId: company._id,
  }).lean();
  if (!voucher)
    throw new ApiError(404, "Voucher not found", ERROR_CODES.NOT_FOUND);

  const toGstin = await findPartyGstin(
    req.organizationId,
    company._id,
    voucher.partyLedger,
  );
  if (!toGstin) {
    throw new ApiError(
      400,
      `No GSTIN found for party "${voucher.partyLedger}". Update the party's GSTIN before generating an E-Way Bill.`,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const { gstin, username, password } = await getCredential(req.organizationId);

  let ewbRecord;
  try {
    const auth = await clearTaxAdapter.authenticate({
      username,
      password,
      gstin,
    });

    // NOTE: exact payload shape must be confirmed against ClearTax's real
    // "Sample API" reference once sandbox access is available — this maps
    // our own fields to what NIC's e-way bill schema conceptually needs.
    const generatePayload = {
      supplyType: "O",
      docType: "INV",
      docNo: voucher.voucherNumber,
      docDate: voucher.date,
      fromGstin: gstin,
      toGstin,
      totalValue: voucher.amount,
      transporterId,
      transporterName,
      transDistance: distanceKm,
      transMode: transportMode,
      vehicleNo: vehicleNumber,
    };

    const result = await clearTaxAdapter.generate({
      authToken: auth.authToken,
      gstin,
      payload: generatePayload,
    });

    const qrCodeImageBase64 = await renderQrCodeImage(
      result.signedQRCode || result.SignedQRCode,
    );

    ewbRecord = await EwayBill.create({
      organizationId: req.organizationId,
      companyId: company._id,
      voucherId: voucher._id,
      ewbNumber: result.ewbNo || result.EwbNo,
      ewbDate: result.ewbDt ? new Date(result.ewbDt) : new Date(),
      validUpto: result.validUpto ? new Date(result.validUpto) : null,
      vehicleNumber,
      transporterName,
      transporterId,
      transportMode,
      distanceKm,
      qrCodeSignedData: result.signedQRCode || result.SignedQRCode || "",
      qrCodeImageBase64,
      status: "GENERATED",
      tallySyncStatus: "PENDING",
      rawResponse: result,
    });
  } catch (err) {
    await EwayBill.create({
      organizationId: req.organizationId,
      companyId: company._id,
      voucherId: voucher._id,
      vehicleNumber,
      transporterName,
      transporterId,
      transportMode,
      distanceKm,
      status: "FAILED",
      errorMessage: err.message,
    });
    throw err;
  }

  // Push the EWB number back into Tally via the existing Command mechanism.
  const command = await Command.create({
    organizationId: req.organizationId,
    companyId: company._id,
    type: "UPDATE_VOUCHER_EWB",
    payload: {
      voucherTallyExternalId: voucher.tallyExternalId,
      ewbNumber: ewbRecord.ewbNumber,
      ewbDate: ewbRecord.ewbDate,
      validUpto: ewbRecord.validUpto,
    },
    status: "PENDING",
  });

  ewbRecord.tallySyncCommandId = command._id;
  await ewbRecord.save();

  await logAudit({
    organizationId: req.organizationId,
    actorType: "USER",
    actorId: req.user._id,
    action: "EWAY_BILL_GENERATED",
    meta: { voucherId, ewbNumber: ewbRecord.ewbNumber },
  });

  return send(
    res,
    201,
    {
      ewayBill: {
        id: ewbRecord._id,
        ewbNumber: ewbRecord.ewbNumber,
        ewbDate: ewbRecord.ewbDate,
        validUpto: ewbRecord.validUpto,
        qrCodeImageBase64: ewbRecord.qrCodeImageBase64,
        status: ewbRecord.status,
        tallySyncStatus: ewbRecord.tallySyncStatus,
      },
    },
    "E-Way Bill generated",
  );
});

// ---- List (My eWay Bills) ----
const list = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const { page, limit, skip } = paginate(req);

  const filter = { organizationId: req.organizationId, companyId: company._id };
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    EwayBill.find(filter)
      .populate(
        "voucherId",
        "voucherNumber voucherType partyLedger amount date",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    EwayBill.countDocuments(filter),
  ]);

  return send(
    res,
    200,
    {
      ewayBills: items.map((e) => ({
        id: e._id,
        ewbNumber: e.ewbNumber,
        ewbDate: e.ewbDate,
        validUpto: e.validUpto,
        status: e.status,
        tallySyncStatus: e.tallySyncStatus,
        vehicleNumber: e.vehicleNumber,
        transporterName: e.transporterName,
        voucher: e.voucherId,
        errorMessage: e.errorMessage,
        createdAt: e.createdAt,
      })),
      total,
      page,
      limit,
    },
    "E-Way Bills",
  );
});

// ---- Get one (with QR) ----
const getOne = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const ewb = await EwayBill.findOne({
    _id: req.params.ewbId,
    organizationId: req.organizationId,
    companyId: company._id,
  })
    .populate("voucherId", "voucherNumber voucherType partyLedger amount date")
    .lean();

  if (!ewb)
    throw new ApiError(
      404,
      "E-Way Bill not found",
      ERROR_CODES.EWAY_BILL_NOT_FOUND,
    );

  return send(res, 200, { ewayBill: ewb }, "E-Way Bill");
});

// ---- Cancel ----
const cancel = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const ewb = await EwayBill.findOne({
    _id: req.params.ewbId,
    organizationId: req.organizationId,
    companyId: company._id,
  });
  if (!ewb)
    throw new ApiError(
      404,
      "E-Way Bill not found",
      ERROR_CODES.EWAY_BILL_NOT_FOUND,
    );
  if (ewb.status !== "GENERATED") {
    throw new ApiError(
      409,
      "Only a generated E-Way Bill can be cancelled",
      ERROR_CODES.CONFLICT,
    );
  }

  const { gstin, username, password } = await getCredential(req.organizationId);
  const auth = await clearTaxAdapter.authenticate({
    username,
    password,
    gstin,
  });
  await clearTaxAdapter.cancel({
    authToken: auth.authToken,
    gstin,
    ewbNo: ewb.ewbNumber,
    reason: req.body.reason,
  });

  ewb.status = "CANCELLED";
  await ewb.save();

  await logAudit({
    organizationId: req.organizationId,
    actorType: "USER",
    actorId: req.user._id,
    action: "EWAY_BILL_CANCELLED",
    meta: { ewbId: ewb._id, ewbNumber: ewb.ewbNumber },
  });

  return send(
    res,
    200,
    { ewayBill: { id: ewb._id, status: ewb.status } },
    "E-Way Bill cancelled",
  );
});

module.exports = { generate, list, getOne, cancel, generateValidators };
