const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");

const LOGO_DIR = path.join(process.cwd(), "uploads", "company-logos");
fs.mkdirSync(LOGO_DIR, { recursive: true });

const ALLOWED_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOGO_DIR),

  filename: (req, file, cb) =>
    cb(
      null,
      `${crypto.randomBytes(16).toString("hex")}${ALLOWED_TYPES[file.mimetype]}`,
    ),
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_TYPES[file.mimetype]) {
    return cb(
      new ApiError(
        422,
        "Logo must be a PNG, JPG or WEBP image",
        ERROR_CODES.VALIDATION_ERROR,
      ),
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const uploadLogo = (req, res, next) => {
  upload.single("logo")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Logo must be 2 MB or smaller"
          : err.message;
      return next(new ApiError(422, message, ERROR_CODES.VALIDATION_ERROR));
    }
    return next(err);
  });
};


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

const removeLogoFile = async (fileName) => {
  if (!fileName) return;
  try {
    await fs.promises.unlink(path.join(LOGO_DIR, path.basename(fileName)));
  } catch (e) {}
};

module.exports = { uploadLogo, isRealImage, removeLogoFile, LOGO_DIR };
