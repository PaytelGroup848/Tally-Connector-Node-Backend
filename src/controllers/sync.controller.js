const { body } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES, PERMISSIONS } = require("../constants/permissions");
const Company = require("../models/Company");
const SyncJob = require("../models/SyncJob");
const SyncCheckpoint = require("../models/SyncCheckpoint");
const SyncError = require("../models/SyncError");
const Ledger = require("../models/Ledger");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const Item = require("../models/Item");
const Voucher = require("../models/Voucher");
const VoucherLine = require("../models/VoucherLine");
const StockBalance = require("../models/StockBalance");
const BillAllocation = require("../models/BillAllocation");
const { pickPartyContact } = require("../utils/partyContact");

const ENTITY_MODELS = {
  LEDGER: Ledger,
  CUSTOMER: Customer,
  SUPPLIER: Supplier,
  ITEM: Item,
  VOUCHER: Voucher,
  VOUCHER_LINE: VoucherLine,
  STOCK: StockBalance,
};

const ENTITY_PERMISSION = {
  LEDGER: PERMISSIONS.SYNC_LEDGER,
  CUSTOMER: PERMISSIONS.SYNC_MASTER,
  SUPPLIER: PERMISSIONS.SYNC_MASTER,
  ITEM: PERMISSIONS.SYNC_MASTER,
  VOUCHER: PERMISSIONS.SYNC_VOUCHER,
  VOUCHER_LINE: PERMISSIONS.SYNC_VOUCHER,
  STOCK: PERMISSIONS.SYNC_STOCK,
};

const startValidators = [
  body("companyId").isMongoId(),
  body("type").isIn(["INITIAL", "INCREMENTAL"]),
];

const batchValidators = [
  body("syncJobId").isMongoId(),
  body("entityType").isString().notEmpty(),
  body("records").isArray(),
];

const completeValidators = [body("syncJobId").isMongoId()];

const assertCompany = async (organizationId, companyId) => {
  const company = await Company.findOne({ _id: companyId, organizationId }).lean();
  if (!company)
    throw new ApiError(404, "Company not found", ERROR_CODES.NOT_FOUND);
  return company;
};

const start = asyncHandler(async (req, res) => {
  const { companyId, type } = req.body;
  await assertCompany(req.organizationId, companyId);

  const job = await SyncJob.create({
    connectorId: req.connector._id,
    organizationId: req.organizationId,
    companyId,
    type,
    status: "RUNNING",
    startedAt: new Date(),
  });

  const checkpoints = await SyncCheckpoint.find({
    connectorId: req.connector._id,
    companyId,
  }).lean();

  return send(
    res,
    200,
    {
      syncJobId: job._id,
      type: job.type,
      checkpoints: checkpoints.map((c) => ({
        entityType: c.entityType,
        lastSyncedAt: c.lastSyncedAt,
        lastSyncedExternalId: c.lastSyncedExternalId,
      })),
    },
    "Sync started",
  );
});

const mapRecord = (entityType, record, ctx) => {
  const base = {
    organizationId: ctx.organizationId,
    companyId: ctx.companyId,
    tallyExternalId: String(record.tallyExternalId),
    raw: record,
  };
  switch (entityType) {
    case "LEDGER": {
      const contact = pickPartyContact(record);
      return {
        ...base,
        name: record.name,
        parent: record.parent || "",
        group: record.group || "",
        ledgerType: record.ledgerType || "",
        openingBalance: record.openingBalance || 0,
        closingBalance: record.closingBalance || 0,
        gstin: contact.gstin || record.gstin || "",
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
      };
    }
    case "CUSTOMER": {
      const contact = pickPartyContact(record);
      return {
        ...base,
        name: record.name,
        gstin: contact.gstin || record.gstin || "",
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        openingBalance: record.openingBalance || 0,
        closingBalance: record.closingBalance || 0,

        creditLimit: record.creditLimit ?? null,
        creditDays: record.creditDays ?? null,
      };
    }
    case "SUPPLIER": {
      const contact = pickPartyContact(record);
      return {
        ...base,
        name: record.name,
        gstin: contact.gstin || record.gstin || "",
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        openingBalance: record.openingBalance || 0,
        closingBalance: record.closingBalance || 0,
      };
    }
    case "ITEM":
      return {
        ...base,
        name: record.name,
        unit: record.unit || "",
        hsn: record.hsn || "",
        rate: record.rate || 0,
      };
    case "VOUCHER":
      return {
        ...base,
        voucherType: record.voucherType || "",
        voucherNumber: record.voucherNumber || "",
        date: record.date ? new Date(record.date) : null,
        partyLedger: record.partyLedger || "",
        amount: record.amount || 0,
        narration: record.narration || "",
      };
    case "VOUCHER_LINE":
      return {
        ...base,
        voucherId: record.voucherId,
        ledgerName: record.ledgerName || "",
        ledgerTallyExternalId: record.ledgerTallyExternalId || "",
        debit: record.debit || 0,
        credit: record.credit || 0,
        itemName: record.itemName || "",
        itemTallyExternalId: record.itemTallyExternalId || "",
        qty: record.qty || 0,
        rate: record.rate || 0,
      };
    case "STOCK":
      return {
        ...base,
        itemName: record.itemName || record.name,
        itemTallyExternalId: record.itemTallyExternalId || "",
        godown: record.godown || "",
        quantity: record.quantity || 0,
        rate: record.rate || 0,
        value: record.value || 0,
      };
    default:
      return base;
  }
};

const normalize = (v = "") => String(v).trim().toLowerCase();

const isCustomerLedger = (l) =>
  l.ledgerType === "CUSTOMER" ||
  normalize(l.parent) === "sundry debtors" ||
  normalize(l.group) === "sundry debtors";

const isSupplierLedger = (l) =>
  l.ledgerType === "SUPPLIER" ||
  normalize(l.parent) === "sundry creditors" ||
  normalize(l.group) === "sundry creditors";

const BULK_WRITE_CHUNK_SIZE = 1000;

const bulkSuccessCount = (result) => {
  const upsertedCount = Number(result?.upsertedCount ?? result?.nUpserted ?? 0);
  const matchedCount = Number(result?.matchedCount ?? result?.nMatched ?? 0);
  const modifiedCount = Number(result?.modifiedCount ?? result?.nModified ?? 0);
  // Prefer matched+upserted so unchanged re-syncs still count as successful,
  // matching the previous findOneAndUpdate increment. Fall back to modified.
  return upsertedCount + (matchedCount || modifiedCount);
};

const executeBulkWrite = async (Model, operations, onWriteError) => {
  let upserted = 0;
  let failed = 0;
  if (!operations.length) return { upserted, failed };

  for (let i = 0; i < operations.length; i += BULK_WRITE_CHUNK_SIZE) {
    const chunk = operations.slice(i, i + BULK_WRITE_CHUNK_SIZE);
    try {
      const result = await Model.bulkWrite(chunk, { ordered: false });
      upserted += bulkSuccessCount(result);
    } catch (err) {
      const result = err.result;
      if (!result && !err.writeErrors) throw err;
      upserted += bulkSuccessCount(result);
      const writeErrors = err.writeErrors || [];
      failed += writeErrors.length;
      if (onWriteError) {
        for (const we of writeErrors) {
          await onWriteError(we, i + (we.index ?? 0));
        }
      }
    }
  }
  return { upserted, failed };
};

const partySetFromLedger = (ledgerDoc) => {
  const contact = pickPartyContact(ledgerDoc);
  const $set = {
    name: ledgerDoc.name,
    gstin: contact.gstin || ledgerDoc.gstin || "",
    openingBalance: ledgerDoc.openingBalance || 0,
    closingBalance: ledgerDoc.closingBalance || 0,
    raw: ledgerDoc.raw || {},
  };
  if (contact.email) $set.email = contact.email;
  if (contact.phone) $set.phone = contact.phone;
  if (contact.address) $set.address = contact.address;
  return $set;
};

const partyUpsertOpsFromLedger = (ledgerDoc) => {
  const customerOps = [];
  const supplierOps = [];
  const filter = {
    organizationId: ledgerDoc.organizationId,
    companyId: ledgerDoc.companyId,
    tallyExternalId: ledgerDoc.tallyExternalId,
  };
  const $set = partySetFromLedger(ledgerDoc);

  if (isCustomerLedger(ledgerDoc)) {
    customerOps.push({
      updateOne: {
        filter,
        update: {
          $set,
          $setOnInsert: {
            creditLimit: null,
            creditDays: null,
            email: $set.email || "",
            phone: $set.phone || "",
            address: $set.address || "",
          },
        },
        upsert: true,
      },
    });
  }

  if (isSupplierLedger(ledgerDoc)) {
    supplierOps.push({
      updateOne: {
        filter,
        update: {
          $set,
          $setOnInsert: {
            email: $set.email || "",
            phone: $set.phone || "",
            address: $set.address || "",
          },
        },
        upsert: true,
      },
    });
  }

  return { customerOps, supplierOps };
};

const loadVouchersByExternalIds = async (organizationId, companyId, externalIds) => {
  const byExternalId = new Map();
  for (let i = 0; i < externalIds.length; i += BULK_WRITE_CHUNK_SIZE) {
    const chunk = externalIds.slice(i, i + BULK_WRITE_CHUNK_SIZE);
    const docs = await Voucher.find({
      organizationId,
      companyId,
      tallyExternalId: { $in: chunk },
    })
      .select("_id tallyExternalId voucherType date partyLedger")
      .lean();
    for (const doc of docs) {
      byExternalId.set(String(doc.tallyExternalId), doc);
    }
  }
  return byExternalId;
};

const mapBillAllocation = (line, voucher, ctx) => ({
  organizationId: ctx.organizationId,
  companyId: ctx.companyId,
  tallyExternalId: String(line.tallyExternalId),
  voucherId: voucher._id,
  voucherType: voucher.voucherType,
  voucherDate: voucher.date,
  partyLedger: voucher.partyLedger,
  billName: line.billName,
  billType: line.billType || "New Ref",
  amount: line.amount || 0,
  dueDate: line.dueDate ? new Date(line.dueDate) : null,
  raw: line,
});

const batch = asyncHandler(async (req, res) => {
  const { syncJobId, entityType, records } = req.body;
  const job = await SyncJob.findOne({
    _id: syncJobId,
    organizationId: req.organizationId,
    connectorId: req.connector._id,
  }).lean();
  if (!job)
    throw new ApiError(
      404,
      "Sync job not found",
      ERROR_CODES.SYNC_JOB_NOT_FOUND,
    );
  if (job.status !== "RUNNING") {
    throw new ApiError(400, "Sync job is not running", ERROR_CODES.CONFLICT);
  }

  const required = ENTITY_PERMISSION[entityType];
  if (required && !req.authContext.permissions.includes(required)) {
    throw new ApiError(
      403,
      "Permission denied for this entity type",
      ERROR_CODES.FORBIDDEN,
    );
  }

  const Model = ENTITY_MODELS[entityType];
  if (!Model) {
    throw new ApiError(
      400,
      `Unknown entityType: ${entityType}`,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const ctx = {
    organizationId: req.organizationId,
    companyId: job.companyId,
  };

  let failed = 0;
  let lastExternalId = null;
  const modelOps = [];
  const modelPayloads = [];
  const voucherOps = [];
  const voucherPayloads = [];
  const customerOps = [];
  const customerPayloads = [];
  const supplierOps = [];
  const supplierPayloads = [];

  const writeSyncError = async (record, errorMessage) => {
    failed += 1;
    await SyncError.create({
      syncJobId: job._id,
      organizationId: req.organizationId,
      entityType,
      errorMessage,
      payload: record,
    });
  };

  for (const record of records) {
    try {
      if (!record?.tallyExternalId) {
        throw new Error("tallyExternalId is required");
      }

      if (entityType === "VOUCHER" && Array.isArray(record.lines)) {
        const doc = mapRecord("VOUCHER", record, ctx);
        voucherOps.push({
          updateOne: {
            filter: {
              organizationId: ctx.organizationId,
              companyId: ctx.companyId,
              tallyExternalId: String(record.tallyExternalId),
            },
            update: { $set: doc },
            upsert: true,
          },
        });
        voucherPayloads.push(record);
        lastExternalId = String(record.tallyExternalId);
        continue;
      }

      const voucherId = record.voucherId;
      const doc = mapRecord(entityType, { ...record, voucherId }, ctx);
      const persistDoc =
        entityType === "LEDGER"
          ? (({ email, phone, address, ...rest }) => rest)(doc)
          : doc;
      modelOps.push({
        updateOne: {
          filter: {
            organizationId: ctx.organizationId,
            companyId: ctx.companyId,
            tallyExternalId: String(record.tallyExternalId),
          },
          update: { $set: persistDoc },
          upsert: true,
        },
      });
      modelPayloads.push(record);

      if (entityType === "LEDGER") {
        const partyOps = partyUpsertOpsFromLedger(doc);
        for (const op of partyOps.customerOps) {
          customerOps.push(op);
          customerPayloads.push(record);
        }
        for (const op of partyOps.supplierOps) {
          supplierOps.push(op);
          supplierPayloads.push(record);
        }
      }

      lastExternalId = String(record.tallyExternalId);
    } catch (err) {
      await writeSyncError(record, err.message);
    }
  }

  const onOpWriteError = (payloads) => async (we, opIndex) => {
    await writeSyncError(
      payloads[opIndex],
      we.errmsg || we.err?.message || "bulkWrite failed",
    );
  };

  let upserted = 0;

  if (voucherOps.length) {
    const voucherWrite = await executeBulkWrite(
      Voucher,
      voucherOps,
      onOpWriteError(voucherPayloads),
    );
    upserted += voucherWrite.upserted;

    const savedByExternalId = await loadVouchersByExternalIds(
      ctx.organizationId,
      ctx.companyId,
      voucherPayloads.map((r) => String(r.tallyExternalId)),
    );

    const lineOps = [];
    const linePayloads = [];
    const billOps = [];
    const billPayloads = [];

    for (const record of voucherPayloads) {
      const saved = savedByExternalId.get(String(record.tallyExternalId));
      if (!saved) continue;

      for (const [idx, line] of record.lines.entries()) {
        const lineExt =
          line.tallyExternalId || `${record.tallyExternalId}:${idx}`;
        const lineDoc = mapRecord(
          "VOUCHER_LINE",
          { ...line, tallyExternalId: lineExt, voucherId: saved._id },
          ctx,
        );
        lineOps.push({
          updateOne: {
            filter: {
              organizationId: ctx.organizationId,
              companyId: ctx.companyId,
              tallyExternalId: lineExt,
            },
            update: { $set: lineDoc },
            upsert: true,
          },
        });
        linePayloads.push(record);
      }

      if (Array.isArray(record.billAllocations)) {
        for (const [idx, bill] of record.billAllocations.entries()) {
          const billExt =
            bill.tallyExternalId || `${record.tallyExternalId}:bill:${idx}`;
          const billDoc = mapBillAllocation(
            { ...bill, tallyExternalId: billExt },
            saved,
            ctx,
          );
          billOps.push({
            updateOne: {
              filter: {
                organizationId: ctx.organizationId,
                companyId: ctx.companyId,
                tallyExternalId: billExt,
              },
              update: { $set: billDoc },
              upsert: true,
            },
          });
          billPayloads.push(record);
        }
      }
    }

    await executeBulkWrite(
      VoucherLine,
      lineOps,
      onOpWriteError(linePayloads),
    );

    await executeBulkWrite(
      BillAllocation,
      billOps,
      onOpWriteError(billPayloads),
    );
  }

  if (modelOps.length) {
    const modelWrite = await executeBulkWrite(
      Model,
      modelOps,
      onOpWriteError(modelPayloads),
    );
    upserted += modelWrite.upserted;
  }

  if (customerOps.length) {
    await executeBulkWrite(
      Customer,
      customerOps,
      onOpWriteError(customerPayloads),
    );
  }
  if (supplierOps.length) {
    await executeBulkWrite(
      Supplier,
      supplierOps,
      onOpWriteError(supplierPayloads),
    );
  }

  await SyncCheckpoint.findOneAndUpdate(
    {
      connectorId: req.connector._id,
      companyId: job.companyId,
      entityType,
    },
    {
      $set: {
        organizationId: req.organizationId,
        lastSyncedAt: new Date(),
        lastSyncedExternalId: lastExternalId,
      },
    },
    { upsert: true },
  );

  return send(res, 200, { upserted, failed, entityType }, "Batch processed");
});

const complete = asyncHandler(async (req, res) => {
  const job = await SyncJob.findOne({
    _id: req.body.syncJobId,
    organizationId: req.organizationId,
    connectorId: req.connector._id,
  });
  if (!job)
    throw new ApiError(
      404,
      "Sync job not found",
      ERROR_CODES.SYNC_JOB_NOT_FOUND,
    );
  job.status = "COMPLETED";
  job.completedAt = new Date();
  await job.save();
  return send(
    res,
    200,
    { syncJobId: job._id, status: job.status, completedAt: job.completedAt },
    "Sync completed",
  );
});

module.exports = {
  start,
  batch,
  complete,
  startValidators,
  batchValidators,
  completeValidators,
};
