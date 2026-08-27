const ApiError = require('../utils/ApiError');
const { ERROR_CODES, ROLE_PERMISSIONS } = require('../constants/permissions');

const requirePermission = (permissionKey) => async (req, res, next) => {
  try {
    const ctx = req.authContext;
    if (!ctx) {
      throw new ApiError(401, 'Not authenticated', ERROR_CODES.UNAUTHORIZED);
    }
    if (!ctx.subscription) {
      throw new ApiError(402, 'No subscription found', ERROR_CODES.SUBSCRIPTION_REQUIRED);
    }
    if (!ctx.subscriptionActive) {
      throw new ApiError(402, 'Subscription has expired', ERROR_CODES.SUBSCRIPTION_EXPIRED);
    }
    if (!ctx.permissions.includes(permissionKey)) {
      throw new ApiError(403, 'Permission denied', ERROR_CODES.FORBIDDEN);
    }
    next();
  } catch (err) {
    next(err);
  }
};

const requireActiveSubscription = async (req, res, next) => {
  try {
    const ctx = req.authContext;
    if (!ctx?.subscription) {
      throw new ApiError(402, 'No subscription found', ERROR_CODES.SUBSCRIPTION_REQUIRED);
    }
    if (!ctx.subscriptionActive) {
      throw new ApiError(402, 'Subscription has expired', ERROR_CODES.SUBSCRIPTION_EXPIRED);
    }
    next();
  } catch (err) {
    next(err);
  }
};

const requireRolePermission = (permissionKey) => async (req, res, next) => {
  try {
    const role = req.authContext?.role;
    const allowed = ROLE_PERMISSIONS[role] || [];
    if (!role || !allowed.includes(permissionKey)) {
      throw new ApiError(403, 'Permission denied', ERROR_CODES.FORBIDDEN);
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requirePermission, requireActiveSubscription, requireRolePermission };
