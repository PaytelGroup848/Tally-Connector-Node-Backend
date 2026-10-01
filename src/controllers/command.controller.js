const { body } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');
const Command = require('../models/Command');
const Company = require('../models/Company');

const createValidators = [
  body('type').isString().notEmpty(),
  body('payload').optional(),
];

const resultValidators = [
  body('status').isIn(['DONE', 'FAILED']),
  body('resultPayload').optional(),
  body('errorMessage').optional().isString(),
];

const create = asyncHandler(async (req, res) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  }).lean();
  if (!company) throw new ApiError(404, 'Company not found', ERROR_CODES.NOT_FOUND);
  if (!company.linkedByConnectorId) {
    throw new ApiError(400, 'Tally company is not linked', ERROR_CODES.TALLY_LINK_REQUIRED);
  }

  const command = await Command.create({
    organizationId: req.organizationId,
    companyId: company._id,
    type: req.body.type,
    payload: req.body.payload || {},
    status: 'PENDING',
    createdBy: req.user._id,
  });

  return send(
    res,
    201,
    {
      command: {
        id: command._id,
        type: command.type,
        status: command.status,
        companyId: command.companyId,
        createdAt: command.createdAt,
      },
    },
    'Command created'
  );
});

const getById = asyncHandler(async (req, res) => {
  const command = await Command.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  }).lean();
  if (!command) throw new ApiError(404, 'Command not found', ERROR_CODES.COMMAND_NOT_FOUND);
  return send(
    res,
    200,
    {
      command: {
        id: command._id,
        type: command.type,
        status: command.status,
        payload: command.payload,
        result: command.result,
        errorMessage: command.errorMessage,
        createdAt: command.createdAt,
        completedAt: command.completedAt,
      },
    },
    'Command'
  );
});

const list = asyncHandler(async (req, res) => {
  const { id: companyId } = req.params;
  const { type, status, from, to, q, voucherType, page = 1, limit = 20 } = req.query;

  const filter = {
    organizationId: req.organizationId,
    companyId,
  };

  if (type) filter.type = type;

  if (status) {
    const statuses = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length) filter.status = { $in: statuses };
  }

  if (voucherType) filter['payload.voucherType'] = voucherType;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  if (q) {
    filter.$or = [
      { 'payload.name': { $regex: q, $options: 'i' } },
      { 'payload.partyName': { $regex: q, $options: 'i' } },
      { 'payload.partyLedger': { $regex: q, $options: 'i' } },
      { 'payload.voucherNumber': { $regex: q, $options: 'i' } },
      { 'payload.itemName': { $regex: q, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Command.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Command.countDocuments(filter),
  ]);

  return send(
    res,
    200,
    {
      commands: items.map((c) => ({
        id: c._id,
        type: c.type,
        status: c.status,
        payload: c.payload,
        result: c.result,
        errorMessage: c.errorMessage,
        createdAt: c.createdAt,
        completedAt: c.completedAt,
      })),
      total,
      page: pageNum,
      limit: limitNum,
    },
    'Commands'
  );
});

const cancel = asyncHandler(async (req, res) => {
  const { id: companyId, commandId } = req.params;
  const command = await Command.findOne({
    _id: commandId,
    companyId,
    organizationId: req.organizationId,
  });
  if (!command) {
    throw new ApiError(404, 'Command not found', ERROR_CODES.COMMAND_NOT_FOUND);
  }
  if (command.status !== 'PENDING') {
    throw new ApiError(409, 'Only pending entries can be cancelled', ERROR_CODES.CONFLICT);
  }
  await command.deleteOne();
  return send(res, 200, null, 'Command cancelled');
});

const poll = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const commands = await Command.find({
    organizationId: req.organizationId,
    status: 'PENDING',
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

  const ids = commands.map((c) => c._id);
  if (ids.length) {
    await Command.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'SENT', sentAt: new Date() } }
    );
  }

  return send(
    res,
    200,
    {
      commands: commands.map((c) => ({
        id: c._id,
        companyId: c.companyId,
        type: c.type,
        payload: c.payload,
        createdAt: c.createdAt,
      })),
    },
    'Pending commands'
  );
});

const submitResult = asyncHandler(async (req, res) => {
  const command = await Command.findOne({
    _id: req.params.commandId,
    organizationId: req.organizationId,
  });
  if (!command) throw new ApiError(404, 'Command not found', ERROR_CODES.COMMAND_NOT_FOUND);

  command.status = req.body.status;
  command.result = req.body.resultPayload || null;
  command.errorMessage = req.body.errorMessage || null;
  command.completedAt = new Date();
  await command.save();

  return send(
    res,
    200,
    { command: { id: command._id, status: command.status, result: command.result } },
    'Result recorded'
  );
});

module.exports = {
  create,
  getById,
  list,
  cancel,
  poll,
  submitResult,
  createValidators,
  resultValidators,
};
