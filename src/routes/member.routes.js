const express = require('express');
const validate = require('../middlewares/validate.middleware');
const webAuth = require('../middlewares/webAuth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const ctrl = require('../controllers/member.controller');

const router = express.Router();

router.use(webAuth);

router.get('/', requirePermission(PERMISSIONS.MEMBER_MANAGE), ctrl.list);
router.post(
  '/invite',
  requirePermission(PERMISSIONS.MEMBER_INVITE),
  ctrl.inviteValidators,
  validate,
  ctrl.invite
);
router.patch(
  '/:id/role',
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  ctrl.roleValidators,
  validate,
  ctrl.changeRole
);
router.delete('/:id', requirePermission(PERMISSIONS.MEMBER_MANAGE), ctrl.remove);

module.exports = router;
