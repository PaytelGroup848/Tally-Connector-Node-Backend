const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");

const companyAccessGuard = (req, res, next) => {
  try {
    const member = req.authContext?.member;
    const companyId = req.params.id;

    if (!member || !companyId) return next();
    if (member.role === "OWNER") return next();

    const allowed = member.allowedCompanies;
    if (!Array.isArray(allowed) || allowed.length === 0) return next();

    const isAllowed = allowed.some((c) => String(c) === String(companyId));
    if (!isAllowed) {
      throw new ApiError(
        403,
        "You do not have access to this company",
        ERROR_CODES.FORBIDDEN,
      );
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = companyAccessGuard;
