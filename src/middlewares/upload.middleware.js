const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");

const LOGO_DIR = path.join(process.cwd(), "uploads", "company-logos");
const SIGNATURE_DIR = path.join(process.cwd(), "uploads", "company-signatures");
fs.mkdirSync(LOGO_DIR, { recursive: true });
fs.mkdirSync(SIGNATURE_DIR, { recursive: true });

const ALLOWED_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

// ---- shared storage builder (folder ke hisaab se) ----
const makeStorage = (dir) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) =>
      cb(
        null,
        `${crypto.randomBytes(16).toString("hex")}${ALLOWED_TYPES[file.mimetype]}`,
      ),
  });

const fileFilter = (label) => (req, file, cb) => {
  if (!ALLOWED_TYPES[file.mimetype]) {
    return cb(
      new ApiError(
        422,
        `${label} must be a PNG, JPG or WEBP image`,
        ERROR_CODES.VALIDATION_ERROR,
      ),
    );
  }
  cb(null, true);
};

// ---- error wrapper (shared) ----
const wrapUpload = (uploader, fieldName, label, maxMb) => (req, res, next) => {
  uploader.single(fieldName)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `${label} must be ${maxMb} MB or smaller`
          : err.message;
      return next(new ApiError(422, message, ERROR_CODES.VALIDATION_ERROR));
    }
    return next(err);
  });
};

// ---- logo upload (2 MB) ----
const logoUpload = multer({
  storage: makeStorage(LOGO_DIR),
  fileFilter: fileFilter("Logo"),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});
const uploadLogo = wrapUpload(logoUpload, "logo", "Logo", 2);

// ---- signature upload (500 KB — signature chhoti hoti hai) ----
const signatureUpload = multer({
  storage: makeStorage(SIGNATURE_DIR),
  fileFilter: fileFilter("Signature"),
  limits: { fileSize: 1024 * 1024, files: 1 },
});
const uploadSignature = wrapUpload(
  signatureUpload,
  "signature",
  "Signature",
  0.5,
);

// ---- real image check (shared) ----
const isRealImage = async (filePath) => {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(12);
    await handle.read(buf, 0, 12, 0);
    const isPng = buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isWebp =
      buf.subarray(0, 4).toString("ascii") === "RIFF" &&
      buf.subarray(8, 12).toString("ascii") === "WEBP";
    return isPng || isJpg || isWebp;
  } finally {
    await handle.close();
  }
};

// ---- removal (shared, folder param ke saath) ----
const removeFile = async (fileName, dir) => {
  if (!fileName) return;
  try {
    await fs.promises.unlink(path.join(dir, path.basename(fileName)));
  } catch (e) {}
};

const removeLogoFile = (fileName) => removeFile(fileName, LOGO_DIR);
const removeSignatureFile = (fileName) => removeFile(fileName, SIGNATURE_DIR);

module.exports = {
  uploadLogo,
  uploadSignature,
  isRealImage,
  removeLogoFile,
  removeSignatureFile,
  LOGO_DIR,
  SIGNATURE_DIR,
};
