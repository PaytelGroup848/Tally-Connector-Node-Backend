const { verifyWebToken } = require("../services/token.service");
const User = require("../models/User");
const OrganizationMember = require("../models/OrganizationMember");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const { resolveForMember } = require("../services/permission.service");

const extractBearer = (req) => {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  const cookieName = process.env.WEB_JWT_COOKIE_NAME || "lk_web_token";
  return req.cookies?.[cookieName] || null;
};

const webAuth = async (req, res, next) => {
  try {
    const token = extractBearer(req);
    if (!token) {
      throw new ApiError(
        401,
        "Web authentication required",
        ERROR_CODES.UNAUTHORIZED,
      );
    }
    const payload = verifyWebToken(token);
    const user = await User.findById(payload.userId);
    if (!user) {
      throw new ApiError(401, "User not found", ERROR_CODES.UNAUTHORIZED);
    }

    const memberships = await OrganizationMember.find({
      userId: user._id,
      status: { $in: ["ACTIVE", "INVITED"] },
    });

    req.user = user;
    req.memberships = memberships;
    req.organizationId = memberships[0]?.organizationId || null;

    if (req.organizationId) {
      const resolved = await resolveForMember(user._id, req.organizationId);
      req.authContext = resolved;
    } else {
      req.authContext = {
        member: null,
        role: null,
        subscription: null,
        plan: null,
        permissions: [],
        subscriptionActive: false,
      };
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = webAuth;
