const { body } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES, PERMISSIONS } = require('../constants/permissions');
const Company = require('../models/Company');
const SyncJob = require('../models/SyncJob');
const SyncCheckpoint = require('../models/SyncCheckpoint');
const SyncError = require('../models/SyncError');
const Ledger = require('../models/Ledger');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Item = require('../models/Item');
const Voucher = require('../models/Voucher');
const VoucherLine = require('../models/VoucherLine');
const StockBalance = require('../models/StockBalance');
const BillAllocation = require('../models/BillAllocation');

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
  body('companyId').isMongoId(),
  body('type').isIn(['INITIAL', 'INCREMENTAL']),
];

const batchValidators = [
  body('syncJobId').isMongoId(),
  body('entityType').isString().notEmpty(),
  body('records').isArray(),
];

const completeValidators = [body('syncJobId').isMongoId()];

const assertCompany = async (organizationId, companyId) => {
  const company = await Company.findOne({ _id: companyId, organizationId });
  if (!company) throw new ApiError(404, 'Company not found', ERROR_CODES.NOT_FOUND);
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
    status: 'RUNNING',
    startedAt: new Date(),
  });

  const checkpoints = await SyncCheckpoint.find({
    connectorId: req.connector._id,
    companyId,
  });

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
    'Sync started'
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
    case 'LEDGER':
      return {
        ...base,
        name: record.name,
        parent: record.parent || '',
        group: record.group || '',
        ledgerType: record.ledgerType || '',
        openingBalance: record.openingBalance || 0,
        closingBalance: record.closingBalance || 0,
        gstin: record.gstin || '',
      };
    case 'CUSTOMER':
      return {
        ...base,
        name: record.name,
        gstin: record.gstin || "",
        email: record.email || "",
        phone: record.phone || "",
        address: record.address || "",
        openingBalance: record.openingBalance || 0,
        closingBalance: record.closingBalance || 0,

        creditLimit: record.creditLimit ?? null,
        creditDays: record.creditDays ?? null,
      };
    case 'SUPPLIER':
      return {
        ...base,
        name: record.name,
        gstin: record.gstin || '',
        email: record.email || '',
        phone: record.phone || '',
        address: record.address || '',
        openingBalance: record.openingBalance || 0,
        closingBalance: record.closingBalance || 0,
      };
    case 'ITEM':
      return {
        ...base,
        name: record.name,
        unit: record.unit || '',
        hsn: record.hsn || '',
        rate: record.rate || 0,
      };
    case 'VOUCHER':
      return {
        ...base,
        voucherType: record.voucherType || '',
        voucherNumber: record.voucherNumber || '',
        date: record.date ? new Date(record.date) : null,
        partyLedger: record.partyLedger || '',
        amount: record.amount || 0,
        narration: record.narration || '',
      };
    case 'VOUCHER_LINE':
      return {
        ...base,
        voucherId: record.voucherId,
        ledgerName: record.ledgerName || '',
        ledgerTallyExternalId: record.ledgerTallyExternalId || '',
        debit: record.debit || 0,
        credit: record.credit || 0,
        itemName: record.itemName || '',
        itemTallyExternalId: record.itemTallyExternalId || '',
        qty: record.qty || 0,
        rate: record.rate || 0,
      };
    case 'STOCK':
      return {
        ...base,
        itemName: record.itemName || record.name,
        itemTallyExternalId: record.itemTallyExternalId || '',
        godown: record.godown || '',
        quantity: record.quantity || 0,
        rate: record.rate || 0,
        value: record.value || 0,
      };
    default:
      return base;
  }
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
  });
  if (!job) throw new ApiError(404, 'Sync job not found', ERROR_CODES.SYNC_JOB_NOT_FOUND);
  if (job.status !== 'RUNNING') {
    throw new ApiError(400, 'Sync job is not running', ERROR_CODES.CONFLICT);
  }

  const required = ENTITY_PERMISSION[entityType];
  if (required && !req.authContext.permissions.includes(required)) {
    throw new ApiError(403, 'Permission denied for this entity type', ERROR_CODES.FORBIDDEN);
  }

  const Model = ENTITY_MODELS[entityType];
  if (!Model) {
    throw new ApiError(400, `Unknown entityType: ${entityType}`, ERROR_CODES.VALIDATION_ERROR);
  }

  let upserted = 0;
  let failed = 0;
  let lastExternalId = null;

  for (const record of records) {
    try {
      if (!record?.tallyExternalId) {
        throw new Error('tallyExternalId is required');
      }

      let voucherId = record.voucherId;
      if (entityType === 'VOUCHER' && Array.isArray(record.lines)) {
        const doc = mapRecord('VOUCHER', record, {
          organizationId: req.organizationId,
          companyId: job.companyId,
        });
        const saved = await Voucher.findOneAndUpdate(
          {
            organizationId: req.organizationId,
            companyId: job.companyId,
            tallyExternalId: String(record.tallyExternalId),
          },
          { $set: doc },
          { upsert: true, new: true }
        );
        upserted += 1;
        lastExternalId = String(record.tallyExternalId);

          for (const [idx, line] of record.lines.entries()) {
            const lineExt =
              line.tallyExternalId || `${record.tallyExternalId}:${idx}`;
            const lineDoc = mapRecord(
              "VOUCHER_LINE",
              { ...line, tallyExternalId: lineExt, voucherId: saved._id },
              {
                organizationId: req.organizationId,
                companyId: job.companyId,
              },
            );
            await VoucherLine.findOneAndUpdate(
              {
                organizationId: req.organizationId,
                companyId: job.companyId,
                tallyExternalId: lineExt,
              },
              { $set: lineDoc },
              { upsert: true, new: true },
            );
          }

          // NEW: bill-wise details (for accurate receivables/payables aging)
          if (Array.isArray(record.billAllocations)) {
            for (const [idx, bill] of record.billAllocations.entries()) {
              const billExt =
                bill.tallyExternalId || `${record.tallyExternalId}:bill:${idx}`;
              const billDoc = mapBillAllocation(
                { ...bill, tallyExternalId: billExt },
                saved,
                {
                  organizationId: req.organizationId,
                  companyId: job.companyId,
                },
              );
              await BillAllocation.findOneAndUpdate(
                {
                  organizationId: req.organizationId,
                  companyId: job.companyId,
                  tallyExternalId: billExt,
                },
                { $set: billDoc },
                { upsert: true, new: true },
              );
            }
          }
        continue;
      }

      const doc = mapRecord(entityType, { ...record, voucherId }, {
        organizationId: req.organizationId,
        companyId: job.companyId,
      });
      await Model.findOneAndUpdate(
        {
          organizationId: req.organizationId,
          companyId: job.companyId,
          tallyExternalId: String(record.tallyExternalId),
        },
        { $set: doc },
        { upsert: true, new: true }
      );
      upserted += 1;
      lastExternalId = String(record.tallyExternalId);
    } catch (err) {
      failed += 1;
      await SyncError.create({
        syncJobId: job._id,
        organizationId: req.organizationId,
        entityType,
        errorMessage: err.message,
        payload: record,
      });
    }
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
    { upsert: true }
  );

  return send(res, 200, { upserted, failed, entityType }, 'Batch processed');
});

const complete = asyncHandler(async (req, res) => {
  const job = await SyncJob.findOne({
    _id: req.body.syncJobId,
    organizationId: req.organizationId,
    connectorId: req.connector._id,
  });
  if (!job) throw new ApiError(404, 'Sync job not found', ERROR_CODES.SYNC_JOB_NOT_FOUND);
  job.status = 'COMPLETED';
  job.completedAt = new Date();
  await job.save();
  return send(
    res,
    200,
    { syncJobId: job._id, status: job.status, completedAt: job.completedAt },
    'Sync completed'
  );
});

module.exports = { start, batch, complete, startValidators, batchValidators, completeValidators };
