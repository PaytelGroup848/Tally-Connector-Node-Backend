const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");
const Company = require("../models/Company");

const list = asyncHandler(async (req, res) => {
  const filter = { organizationId: req.organizationId, isActive: true };

  const member = req.authContext?.member;
  const allowed = member?.allowedCompanies;
  if (
    member &&
    member.role !== "OWNER" &&
    Array.isArray(allowed) &&
    allowed.length > 0
  ) {
    filter._id = { $in: allowed };
  }

  const companies = await Company.find(filter).lean();
  return send(
    res,
    200,
    {
      companies: companies.map((c) => ({
        id: c._id,
        tallyCompanyName: c.tallyCompanyName,
        tallyCompanyGuid: c.tallyCompanyGuid,
        linkedByConnectorId: c.linkedByConnectorId,
        createdAt: c.createdAt,
      })),
    },
    "Companies",
  );
});

const getById = asyncHandler(async (req, res) => {
  const company = await Company.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
  }).lean();
  if (!company)
    throw new ApiError(404, "Company not found", ERROR_CODES.NOT_FOUND);
  return send(
    res,
    200,
    {
      company: {
        id: company._id,
        tallyCompanyName: company.tallyCompanyName,
        tallyCompanyGuid: company.tallyCompanyGuid,
        linkedByConnectorId: company.linkedByConnectorId,
        createdAt: company.createdAt,
      },
    },
    "Company",
  );
});

module.exports = { list, getById };
