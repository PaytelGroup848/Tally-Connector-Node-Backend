const { body, param } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES, ROLE } = require('../constants/permissions');
const OrganizationMember = require('../models/OrganizationMember');
const Notification = require('../models/Notification');
const { ensureUser } = require('../services/org.service');
const { assertSeatAvailable } = require('../services/subscription.service');
const { logAudit } = require('../services/audit.service');

const inviteValidators = [
  body('email').isEmail(),
  body('role').isIn([ROLE.ADMIN, ROLE.ACCOUNTANT, ROLE.VIEWER, ROLE.OWNER]),
];

const roleValidators = [
  param('id').isMongoId(),
  body('role').isIn([ROLE.ADMIN, ROLE.ACCOUNTANT, ROLE.VIEWER, ROLE.OWNER]),
];

const list = asyncHandler(async (req, res) => {
  const members = await OrganizationMember.find({
    organizationId: req.organizationId,
    status: { $ne: 'REMOVED' },
  }).populate('userId', 'email isVerified');

  return send(
    res,
    200,
    {
      members: members.map((m) => ({
        id: m._id,
        userId: m.userId?._id,
        email: m.userId?.email,
        role: m.role,
        status: m.status,
        createdAt: m.createdAt,
      })),
    },
    'Members'
  );
});

const invite = asyncHandler(async (req, res) => {
  await assertSeatAvailable(req.organizationId);
  const email = req.body.email.toLowerCase().trim();
  const { role } = req.body;
  const user = await ensureUser(email);

  let member = await OrganizationMember.findOne({
    organizationId: req.organizationId,
    userId: user._id,
  });

  if (member && member.status !== 'REMOVED') {
    throw new ApiError(409, 'Member already exists', ERROR_CODES.CONFLICT);
  }

  if (member) {
    member.role = role;
    member.status = 'INVITED';
    member.invitedBy = req.user._id;
    await member.save();
  } else {
    member = await OrganizationMember.create({
      organizationId: req.organizationId,
      userId: user._id,
      role,
      status: 'INVITED',
      invitedBy: req.user._id,
    });
  }

  await Notification.create({
    organizationId: req.organizationId,
    userId: user._id,
    type: 'MEMBER_INVITE',
    message: `You were invited to an organization as ${role}`,
  });

  await logAudit({
    organizationId: req.organizationId,
    actorType: 'USER',
    actorId: req.user._id,
    action: 'MEMBER_INVITED',
    meta: { email, role },
  });

  return send(
    res,
    201,
    { member: { id: member._id, email, role, status: member.status } },
    'Member invited'
  );
});

const changeRole = asyncHandler(async (req, res) => {
  const member = await OrganizationMember.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    status: { $ne: 'REMOVED' },
  });
  if (!member) throw new ApiError(404, 'Member not found', ERROR_CODES.NOT_FOUND);

  if (member.role === ROLE.OWNER && req.body.role !== ROLE.OWNER) {
    const owners = await OrganizationMember.countDocuments({
      organizationId: req.organizationId,
      role: ROLE.OWNER,
      status: { $in: ['ACTIVE', 'INVITED'] },
    });
    if (owners <= 1) {
      throw new ApiError(400, 'Cannot demote the last owner', ERROR_CODES.FORBIDDEN);
    }
  }

  const previous = member.role;
  member.role = req.body.role;
  await member.save();
  await logAudit({
    organizationId: req.organizationId,
    actorType: 'USER',
    actorId: req.user._id,
    action: 'MEMBER_ROLE_CHANGED',
    meta: { memberId: member._id, previous, role: member.role },
  });
  return send(res, 200, { member: { id: member._id, role: member.role } }, 'Role updated');
});

const remove = asyncHandler(async (req, res) => {
  const member = await OrganizationMember.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    status: { $ne: 'REMOVED' },
  });
  if (!member) throw new ApiError(404, 'Member not found', ERROR_CODES.NOT_FOUND);
  if (String(member.userId) === String(req.user._id)) {
    throw new ApiError(400, 'Cannot remove yourself', ERROR_CODES.FORBIDDEN);
  }
  if (member.role === ROLE.OWNER) {
    throw new ApiError(400, 'Cannot remove an owner', ERROR_CODES.FORBIDDEN);
  }
  member.status = 'REMOVED';
  await member.save();
  await logAudit({
    organizationId: req.organizationId,
    actorType: 'USER',
    actorId: req.user._id,
    action: 'MEMBER_REMOVED',
    meta: { memberId: member._id },
  });
  return send(res, 200, null, 'Member removed');
});

module.exports = { list, invite, changeRole, remove, inviteValidators, roleValidators };
