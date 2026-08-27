const webAuth = require('./webAuth.middleware');
const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants/permissions');

const superAdminAuth = [
  webAuth,
  (req, res, next) => {
    const configured = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();
    const email = (req.user?.email || '').toLowerCase().trim();
    if (!configured || email !== configured || !req.user.isSuperAdmin) {
      return next(new ApiError(403, 'Super admin access required', ERROR_CODES.FORBIDDEN));
    }
    next();
  },
];

module.exports = superAdminAuth;
