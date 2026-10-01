const { body } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const { send } = require("../utils/ApiResponse");
const OrganizationGspCredential = require("./OrganizationGspCredential");

const saveValidators = [
  body("gstin").isString().notEmpty(),
  body("username").isString().notEmpty(),
  body("password").isString().notEmpty(),
];

const getSettings = asyncHandler(async (req, res) => {
  const credential = await OrganizationGspCredential.findOne({
    organizationId: req.organizationId,
  }).lean();

  if (!credential) {
    return send(res, 200, { configured: false }, "GSP settings");
  }

  return send(
    res,
    200,
    {
      configured: true,
      provider: credential.provider,
      gstin: credential.gstin,
      isActive: credential.isActive,
      // never return decrypted username/password to the frontend
    },
    "GSP settings",
  );
});

const saveSettings = asyncHandler(async (req, res) => {
  const { gstin, username, password } = req.body;

  const encryptedUsername = OrganizationGspCredential.encrypt(username);
  const encryptedPassword = OrganizationGspCredential.encrypt(password);

  const credential = await OrganizationGspCredential.findOneAndUpdate(
    { organizationId: req.organizationId },
    {
      $set: {
        organizationId: req.organizationId,
        provider: "CLEARTAX",
        gstin,
        encryptedUsername,
        encryptedPassword,
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );

  return send(
    res,
    200,
    {
      configured: true,
      provider: credential.provider,
      gstin: credential.gstin,
    },
    "GSP settings saved",
  );
});

module.exports = { getSettings, saveSettings, saveValidators };
