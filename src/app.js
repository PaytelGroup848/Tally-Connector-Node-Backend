const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const routes = require("./routes");
const errorHandler = require("./middlewares/errorHandler.middleware");
const ApiError = require("./utils/ApiError");
const { ERROR_CODES } = require("./constants/permissions");
const path = require("path");

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

app.use(
  "/api/uploads",
  (req, res, next) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(process.cwd(), "uploads"), {
    maxAge: "7d",
    index: false,
    dotfiles: "deny",
  }),
);

app.use("/api", routes);

app.use((req, res, next) => {
  next(
    new ApiError(
      404,
      `Route not found: ${req.method} ${req.originalUrl}`,
      ERROR_CODES.NOT_FOUND,
    ),
  );
});

app.use(errorHandler);

module.exports = app;
