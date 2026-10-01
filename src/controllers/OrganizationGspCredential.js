const mongoose = require("mongoose");
const crypto = require("crypto");

const ALGO = "aes-256-gcm";

const encrypt = (text) => {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(process.env.GSP_CREDENTIAL_ENC_KEY, "hex");
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decrypt = (payload) => {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const key = Buffer.from(process.env.GSP_CREDENTIAL_ENC_KEY, "hex");
  const decipher = crypto.createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
};

const gspCredentialSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    provider: { type: String, default: "CLEARTAX" },
    gstin: { type: String, required: true, trim: true },
    encryptedUsername: { type: String, required: true },
    encryptedPassword: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

gspCredentialSchema.statics.encrypt = encrypt;
gspCredentialSchema.statics.decrypt = decrypt;

module.exports = mongoose.model(
  "OrganizationGspCredential",
  gspCredentialSchema,
);
