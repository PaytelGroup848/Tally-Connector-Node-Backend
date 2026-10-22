const { body, param } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const Company = require("../models/Company");
const CompanyProfile = require("../models/CompanyProfile");
const CompanyBankAccount = require("../models/CompanyBankAccount");
const {
  removeLogoFile,
  removeSignatureFile,
  isRealImage,
} = require("../middlewares/upload.middleware");
const { logAudit } = require("../services/audit.service");
const { postTallyCommand } = require("../services/tallyCommand.service");
const { default: mongoose } = require("mongoose");

const MAX_BANKS_PER_COMPANY = 20;

const PROFILE_FIELDS = [
  "address",
  "gstin",
  "cin",
  "pan",
  "mobile",
  "email",
  "website",
  "state",
  "stateCode",
  "msmeNumber",
  "termsAndConditions",
];
const BANK_FIELDS = [
  "bankName",
  "under",
  "accountHolderName",
  "accountNumber",
  "ifscCode",
  "swiftCode",
  "branchName",
];

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
const CIN_REGEX = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const SWIFT_REGEX = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

const upper = (v) => (typeof v === "string" ? v.trim().toUpperCase() : v);
const lower = (v) => (typeof v === "string" ? v.trim().toLowerCase() : v);
const trimmed = (v) => (typeof v === "string" ? v.trim() : v);
// Lets "" through so a field can be cleared, but still validates real values.
const allowEmpty = { checkFalsy: true };

const pick = (obj, keys) =>
  keys.reduce((acc, key) => {
    if (obj[key] !== undefined) acc[key] = obj[key];
    return acc;
  }, {});

/* ------------------------------ helpers ------------------------------ */

const scopedCompany = async (req) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  })
    .select("tallyCompanyName")
    .lean();
  if (!company)
    throw new ApiError(404, "Company not found", ERROR_CODES.NOT_FOUND);
  return company;
};

const buildFileUrl = (req, folder, fileName) => {
  if (!fileName) return null;
  const base = (
    process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`
  ).replace(/\/$/, "");
  return `${base}/api/uploads/${folder}/${fileName}`;
};

const buildLogoUrl = (req, fileName) =>
  buildFileUrl(req, "company-logos", fileName);

const buildSignatureUrl = (req, fileName) =>
  buildFileUrl(req, "company-signatures", fileName);

const shapeProfile = (req, company, profile) => ({
  company: { id: company._id, companyName: company.tallyCompanyName },
  profile: {
    address: profile?.address || "",
    gstin: profile?.gstin || "",
    cin: profile?.cin || "",
    pan: profile?.pan || "",
    mobile: profile?.mobile || "",
    email: profile?.email || "",
    website: profile?.website || "",
    state: profile?.state || "",
    stateCode: profile?.stateCode || "",
    msmeNumber: profile?.msmeNumber || "",
    termsAndConditions: profile?.termsAndConditions || "",
    logoUrl: buildLogoUrl(req, profile?.logoFileName),
    signatureUrl: buildSignatureUrl(req, profile?.signatureFileName),
    updatedAt: profile?.updatedAt || null,
  },
});

const shapeBank = (b) => ({
  id: b._id,
  tallyExternalId: b.tallyExternalId || "",
  bankName: b.bankName,
  under: b.under,
  accountHolderName: b.accountHolderName,
  accountNumber: b.accountNumber,
  ifscCode: b.ifscCode,
  swiftCode: b.swiftCode || "",
  branchName: b.branchName || "",
  isDefault: Boolean(b.isDefault),
  createdAt: b.createdAt,
});

const audit = (req, action, meta) =>
  logAudit({
    organizationId: req.organizationId,
    actorType: "USER",
    actorId: req.user._id,
    action,
    meta,
  });

/* ------------------------------ validators ------------------------------ */

const idValidators = [param("id").isMongoId()];
const bankIdValidators = [param("id").isMongoId(), param("bankId").isMongoId()];

const profileValidators = [
  param("id").isMongoId(),
  body("address").optional().isString().trim().isLength({ max: 500 }),
  body("gstin")
    .optional(allowEmpty)
    .customSanitizer(upper)
    .matches(GSTIN_REGEX)
    .withMessage("Invalid GSTIN"),
  body("cin")
    .optional(allowEmpty)
    .customSanitizer(upper)
    .matches(CIN_REGEX)
    .withMessage("Invalid CIN"),
  body("pan")
    .optional(allowEmpty)
    .customSanitizer(upper)
    .matches(PAN_REGEX)
    .withMessage("Invalid PAN"),
  body("email")
    .optional(allowEmpty)
    .customSanitizer(lower)
    .isEmail()
    .withMessage("Invalid email"),
  body("website")
    .optional(allowEmpty)
    .trim()
    .isLength({ max: 200 })
    .isURL({ require_protocol: false, protocols: ["http", "https"] })
    .withMessage("Invalid website URL"),
  body("state").optional().isString().trim().isLength({ max: 60 }),
  body("stateCode")
    .optional(allowEmpty)
    .customSanitizer(trimmed)
    .matches(/^\d{2}$/)
    .withMessage("State code must be 2 digits"),
  body("msmeNumber")
    .optional(allowEmpty)
    .customSanitizer(upper)
    .isLength({ max: 30 })
    .withMessage("MSME number too long"),
  body("termsAndConditions")
    .optional()
    .isString()
    .isLength({ max: 800 })
    .withMessage("Terms & conditions can be at most 800 characters"),
];

const bankRules = (required) => {
  const field = (name) => (required ? body(name) : body(name).optional());
  return [
    param("id").isMongoId(),
    param("bankId").optional().isMongoId(),
    field("bankName").isString().trim().notEmpty().isLength({ max: 100 }),
    field("under")
      .isIn(CompanyBankAccount.BANK_UNDER)
      .withMessage(
        `under must be one of: ${CompanyBankAccount.BANK_UNDER.join(", ")}`,
      ),
    field("accountHolderName")
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 100 }),
    field("accountNumber")
      .customSanitizer(trimmed)
      .matches(/^\d{6,20}$/)
      .withMessage("Account number must be 6-20 digits"),
    field("ifscCode")
      .customSanitizer(upper)
      .matches(IFSC_REGEX)
      .withMessage("Invalid IFSC code"),
    body("swiftCode")
      .optional(allowEmpty)
      .customSanitizer(upper)
      .matches(SWIFT_REGEX)
      .withMessage("Invalid SWIFT code"),
    body("branchName").optional().isString().trim().isLength({ max: 100 }),
    body("isDefault").optional().isBoolean().toBoolean(),
  ];
};

const bankCreateValidators = bankRules(true);
const bankUpdateValidators = bankRules(false);

/* ------------------------------ company profile ------------------------------ */

const getProfile = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const profile = await CompanyProfile.findOne({
    organizationId: req.organizationId,
    companyId: company._id,
  }).lean();

  return send(
    res,
    200,
    shapeProfile(req, company, profile),
    "Company settings",
  );
});

const updateProfile = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const scope = { organizationId: req.organizationId, companyId: company._id };

  const updates = pick(req.body, PROFILE_FIELDS);
  if (Object.keys(updates).length === 0) {
    throw new ApiError(
      422,
      "No fields to update",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  // The first two digits of a GSTIN are always the state code.
  const existing = await CompanyProfile.findOne(scope).lean();
  const merged = { ...(existing || {}), ...updates };
  if (
    merged.gstin &&
    merged.stateCode &&
    merged.gstin.slice(0, 2) !== merged.stateCode
  ) {
    throw new ApiError(
      422,
      "GSTIN and state code do not match (first two digits of the GSTIN must equal the state code)",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const profile = await CompanyProfile.findOneAndUpdate(
    scope,
    { $set: updates },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  await audit(req, "COMPANY_PROFILE_UPDATED", {
    companyId: company._id,
    fields: Object.keys(updates),
  });

  return send(
    res,
    200,
    shapeProfile(req, company, profile),
    "Company settings saved",
  );
});

const uploadLogoHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(
      422,
      "Logo file is required (form-data key: logo)",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  let company;
  try {
    company = await scopedCompany(req);
    if (!(await isRealImage(req.file.path))) {
      throw new ApiError(
        422,
        "File is not a valid PNG, JPG or WEBP image",
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
  } catch (err) {
    await removeLogoFile(req.file.filename); // never leave an orphan file behind
    throw err;
  }

  const scope = { organizationId: req.organizationId, companyId: company._id };
  const previous = await CompanyProfile.findOne(scope)
    .select("logoFileName")
    .lean();

  const profile = await CompanyProfile.findOneAndUpdate(
    scope,
    { $set: { logoFileName: req.file.filename } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  if (previous?.logoFileName) await removeLogoFile(previous.logoFileName);

  await audit(req, "COMPANY_LOGO_UPDATED", { companyId: company._id });

  return send(
    res,
    200,
    { logoUrl: buildLogoUrl(req, profile.logoFileName) },
    "Logo updated",
  );
});

const removeLogo = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);

  // new: false -> returns the document as it was BEFORE the update, so we know which file to delete.
  const before = await CompanyProfile.findOneAndUpdate(
    { organizationId: req.organizationId, companyId: company._id },
    { $set: { logoFileName: "" } },
    { new: false },
  ).lean();

  if (before?.logoFileName) await removeLogoFile(before.logoFileName);

  await audit(req, "COMPANY_LOGO_REMOVED", { companyId: company._id });

  return send(res, 200, { logoUrl: null }, "Logo removed");
});

const uploadSignatureHandler = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(
      422,
      "Signature file is required (form-data key: signature)",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  let company;
  try {
    company = await scopedCompany(req);
    if (!(await isRealImage(req.file.path))) {
      throw new ApiError(
        422,
        "File is not a valid PNG, JPG or WEBP image",
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
  } catch (err) {
    await removeSignatureFile(req.file.filename);
    throw err;
  }

  const scope = { organizationId: req.organizationId, companyId: company._id };
  const previous = await CompanyProfile.findOne(scope)
    .select("signatureFileName")
    .lean();

  const profile = await CompanyProfile.findOneAndUpdate(
    scope,
    { $set: { signatureFileName: req.file.filename } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  if (previous?.signatureFileName)
    await removeSignatureFile(previous.signatureFileName);

  await audit(req, "COMPANY_SIGNATURE_UPDATED", { companyId: company._id });

  return send(
    res,
    200,
    { signatureUrl: buildSignatureUrl(req, profile?.signatureFileName) },
    "Signature updated",
  );
});

const removeSignature = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);

  const before = await CompanyProfile.findOneAndUpdate(
    { organizationId: req.organizationId, companyId: company._id },
    { $set: { signatureFileName: "" } },
    { new: false },
  ).lean();

  if (before?.signatureFileName)
    await removeSignatureFile(before.signatureFileName);

  await audit(req, "COMPANY_SIGNATURE_REMOVED", { companyId: company._id });

  return send(res, 200, { signatureUrl: null }, "Signature removed");
});

/* ------------------------------ bank accounts ------------------------------ */

const setDefaultBank = async (scope, bankId) => {
  // Unset the old default first, so the one-default-per-company unique index is never violated.
  await CompanyBankAccount.updateMany(
    { ...scope, _id: { $ne: bankId }, isDefault: true },
    { $set: { isDefault: false } },
  );
  return CompanyBankAccount.findOneAndUpdate(
    { ...scope, _id: bankId },
    { $set: { isDefault: true } },
    { new: true },
  );
};

const listBanks = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);

  const banks = await CompanyBankAccount.find({
    organizationId: req.organizationId,
    companyId: company._id,
  })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean();

  return send(
    res,
    200,
    {
      banks: banks.map(shapeBank),
      total: banks.length,
      underOptions: CompanyBankAccount.BANK_UNDER,
    },
    "Bank accounts",
  );
});

const createBank = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const scope = { organizationId: req.organizationId, companyId: company._id };

  const count = await CompanyBankAccount.countDocuments(scope);
  if (count >= MAX_BANKS_PER_COMPANY) {
    throw new ApiError(
      422,
      `A company can have at most ${MAX_BANKS_PER_COMPANY} bank accounts`,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const data = pick(req.body, BANK_FIELDS);

  const duplicate = await CompanyBankAccount.exists({
    ...scope,
    accountNumber: data.accountNumber,
    ifscCode: data.ifscCode,
  });
  if (duplicate) {
    throw new ApiError(
      409,
      "This account number with the same IFSC already exists for this company",
      ERROR_CODES.CONFLICT,
    );
  }

  let bank;
  try {
    bank = await CompanyBankAccount.create({
      ...scope,
      ...data,
      isDefault: false,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(
        409,
        "This bank account already exists for this company",
        ERROR_CODES.CONFLICT,
      );
    }
    throw err;
  }

  if (count === 0 || req.body.isDefault === true) {
    bank = await setDefaultBank(scope, bank._id);
  }

  try {
    await postTallyCommand({
      organizationId: req.organizationId,
      companyId: company._id,
      type: "CREATE_LEDGER",
      payload: {
        companyId: String(company._id),
        ledgerName: bank.bankName,
        parent: bank.under || "Bank Accounts",
        ledgerType: "BANK",
        openingBalance: 0,
        gstin: "",
        description: "",
        bankDetails: {
          accountHolderName: bank.accountHolderName,
          accountNumber: bank.accountNumber,
          ifscCode: bank.ifscCode,
          swiftCode: bank.swiftCode || "",
          branchName: bank.branchName || "",
          bankName: bank.bankName,
        },
      },
      user: req.user,
    });
  } catch (syncErr) {
    // Tally sync fail ho toh MongoDB se bhi hata do
    await bank.deleteOne();
    console.error("Tally bank ledger creation failed:", syncErr);
    throw new ApiError(
      502,
      `Bank save failed at Tally: ${syncErr.message}. Please try again.`,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  await audit(req, "COMPANY_BANK_ADDED", {
    companyId: company._id,
    bankId: bank._id,
    bankName: bank.bankName,
  });

  return send(
    res,
    201,
    { bank: shapeBank(bank), tallySynced: true },
    "Bank account added",
  );
});

const updateBank = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const scope = { organizationId: req.organizationId, companyId: company._id };

  let bank = await CompanyBankAccount.findOne({
    ...scope,
    _id: req.params.bankId,
  });
  if (!bank)
    throw new ApiError(404, "Bank account not found", ERROR_CODES.NOT_FOUND);

  const data = pick(req.body, BANK_FIELDS);

  if (req.body.isDefault === false) {
    throw new ApiError(
      422,
      "A company must always have a default bank — set another bank as default instead",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }
  if (Object.keys(data).length === 0 && req.body.isDefault === undefined) {
    throw new ApiError(
      422,
      "No fields to update",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const nextAccount = data.accountNumber ?? bank.accountNumber;
  const nextIfsc = data.ifscCode ?? bank.ifscCode;
  if (nextAccount !== bank.accountNumber || nextIfsc !== bank.ifscCode) {
    const duplicate = await CompanyBankAccount.exists({
      ...scope,
      accountNumber: nextAccount,
      ifscCode: nextIfsc,
      _id: { $ne: bank._id },
    });
    if (duplicate) {
      throw new ApiError(
        409,
        "This account number with the same IFSC already exists for this company",
        ERROR_CODES.CONFLICT,
      );
    }
  }

  Object.assign(bank, data);
  try {
    await bank.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(
        409,
        "This bank account already exists for this company",
        ERROR_CODES.CONFLICT,
      );
    }
    throw err;
  }

  const isTallySynced = Boolean(bank.tallyExternalId);

  if (isTallySynced) {
    try {
      await postTallyCommand({
        organizationId: req.organizationId,
        companyId: company._id,
        type: "UPDATE_LEDGER",
        payload: {
          companyId: String(company._id),
          ledgerId: String(bank._id),
          tallyExternalId: bank.tallyExternalId,
          ledgerName: bank.bankName,
          parent: bank.under || "Bank Accounts",
          ledgerType: "BANK",
          bankDetails: {
            accountHolderName: bank.accountHolderName,
            accountNumber: bank.accountNumber,
            ifscCode: bank.ifscCode,
            swiftCode: bank.swiftCode || "",
            branchName: bank.branchName || "",
            bankName: bank.bankName,
          },
        },
        user: req.user,
      });
    } catch (syncErr) {
      console.error("Tally bank ledger update failed:", syncErr);
      // Update fail ho toh error throw karo (MongoDB mein save toh ho gaya)
      throw new ApiError(
        502,
        `Bank updated locally, but Tally sync failed: ${syncErr.message}`,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
  }
  // TALLY UPDATE SYNC KHATAM

  await audit(req, "COMPANY_BANK_UPDATED", {
    companyId: company._id,
    bankId: bank._id,
    fields: Object.keys(data),
  });

  return send(
    res,
    200,
    { bank: shapeBank(bank), tallySynced: isTallySynced },
    "Bank account updated",
  );
});

const makeDefaultBank = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const scope = { organizationId: req.organizationId, companyId: company._id };

  const exists = await CompanyBankAccount.exists({
    ...scope,
    _id: req.params.bankId,
  });
  if (!exists)
    throw new ApiError(404, "Bank account not found", ERROR_CODES.NOT_FOUND);

  const bank = await setDefaultBank(scope, req.params.bankId);

  await audit(req, "COMPANY_BANK_DEFAULT_CHANGED", {
    companyId: company._id,
    bankId: bank._id,
  });

  return send(res, 200, { bank: shapeBank(bank) }, "Default bank updated");
});

const updateTallyBankLedger = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const scope = { organizationId: req.organizationId, companyId: company._id };
  const { tallyExternalId } = req.params;
  const data = pick(req.body, BANK_FIELDS);

  if (!tallyExternalId) {
    throw new ApiError(
      400,
      "Tally external ID is required",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  // 👇 Case 1: MongoDB _id (app bank hai)
  if (mongoose.isValidObjectId(tallyExternalId)) {
    const bank = await CompanyBankAccount.findOne({
      ...scope,
      _id: tallyExternalId,
    });

    if (!bank) {
      throw new ApiError(404, "Bank account not found", ERROR_CODES.NOT_FOUND);
    }

    Object.assign(bank, data);
    await bank.save();

    if (bank.tallyExternalId) {
      await postTallyCommand({
        organizationId: req.organizationId,
        companyId: company._id,
        type: "UPDATE_LEDGER",
        payload: {
          companyId: String(company._id),
          tallyExternalId: bank.tallyExternalId,
          ledgerName: bank.bankName,
          parent: bank.under || "Bank Accounts",
          ledgerType: "BANK",
          bankDetails: {
            accountHolderName: bank.accountHolderName,
            accountNumber: bank.accountNumber,
            ifscCode: bank.ifscCode,
            swiftCode: bank.swiftCode || "",
            branchName: bank.branchName || "",
            bankName: bank.bankName,
          },
        },
        user: req.user,
      });
    }

    return send(
      res,
      200,
      { bank: shapeBank(bank), tallySynced: Boolean(bank.tallyExternalId) },
      "Bank updated",
    );
  }

  // 👇 Case 2: Tally UUID (sirf Tally bank)
  if (Object.keys(data).length === 0) {
    throw new ApiError(
      422,
      "No fields to update",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  await postTallyCommand({
    organizationId: req.organizationId,
    companyId: company._id,
    type: "UPDATE_LEDGER",
    payload: {
      companyId: String(company._id),
      tallyExternalId,
      ledgerName: data.bankName || req.body.bankName,
      parent: data.under || req.body.under || "Bank Accounts",
      ledgerType: "BANK",
      bankDetails: {
        accountHolderName: data.accountHolderName || req.body.accountHolderName,
        accountNumber: data.accountNumber || req.body.accountNumber,
        ifscCode: data.ifscCode || req.body.ifscCode,
        swiftCode: data.swiftCode || req.body.swiftCode || "",
        branchName: data.branchName || req.body.branchName || "",
        bankName: data.bankName || req.body.bankName,
      },
    },
    user: req.user,
  });

  return send(res, 200, { tallySynced: true }, "Bank sent to Tally for update");
});
const deleteBank = asyncHandler(async (req, res) => {
  const company = await scopedCompany(req);
  const scope = { organizationId: req.organizationId, companyId: company._id };

  const bank = await CompanyBankAccount.findOne({
    ...scope,
    _id: req.params.bankId,
  });
  if (!bank)
    throw new ApiError(404, "Bank account not found", ERROR_CODES.NOT_FOUND);

  const wasDefault = bank.isDefault;
  await bank.deleteOne();

  // If the default bank was removed, promote the oldest remaining one.
  if (wasDefault) {
    const next = await CompanyBankAccount.findOne(scope)
      .sort({ createdAt: 1 })
      .select("_id")
      .lean();
    if (next) await setDefaultBank(scope, next._id);
  }

  await audit(req, "COMPANY_BANK_REMOVED", {
    companyId: company._id,
    bankId: bank._id,
    bankName: bank.bankName,
  });

  return send(res, 200, null, "Bank account removed");
});

module.exports = {
  idValidators,
  bankIdValidators,
  profileValidators,
  bankCreateValidators,
  bankUpdateValidators,
  getProfile,
  updateProfile,
  uploadLogoHandler,
  uploadSignatureHandler,
  removeSignature,
  removeLogo,
  listBanks,
  createBank,
  updateBank,
  makeDefaultBank,
  deleteBank,
  updateTallyBankLedger,
};
