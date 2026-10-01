const axios = require("axios");
const ApiError = require("../../utils/ApiError");
const { ERROR_CODES } = require("../../constants/permissions");

const BASE_URL =
  process.env.CLEARTAX_ENV === "production"
    ? "https://api.clear.in"
    : "https://api-sandbox.clear.in";

const API_VERSION = "/ewb-gsp/v1.03";

// ClearTax/NIC sometimes respond with HTTP 200 but a body that is a
// PLAIN STRING containing an embedded JSON error (e.g.
// `AuthenticationException: {"statusCode":"0","error":"<base64>","info":""}`),
// not a parsed JSON object. Axios never throws on 200, and property access
// on a string (data.statusCode) silently returns undefined instead of
// failing loudly — so every response must be normalized and inspected here
// before it's trusted.
const normalizeResponseData = (raw) => {
  if (raw && typeof raw === "object") return raw;

  if (typeof raw === "string") {
    // Try parsing the whole string as JSON first.
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Fall through — it wasn't pure JSON.
    }
    // Try extracting an embedded {...} JSON blob from strings like
    // "AuthenticationException: {...}".
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        // Fall through — embedded blob wasn't valid JSON either.
      }
    }
    // Unparseable string — treat the raw text itself as the error message.
    return { statusCode: "0", error: null, rawMessage: raw };
  }

  return {
    statusCode: "0",
    error: null,
    rawMessage: "Empty or unrecognized response",
  };
};

const decodeErrorMessage = (data, defaultMessage) => {
  if (data?.error) {
    try {
      const decoded = Buffer.from(data.error, "base64").toString("utf8");
      if (decoded) return decoded;
    } catch (e) {
      return data.error;
    }
  }
  if (data?.rawMessage) return data.rawMessage;
  if (data?.message) return data.message;
  return defaultMessage;
};

// Returns the normalized (parsed) data on success. Throws ApiError on any
// failure shape — including raw-string / non-JSON responses.
const assertSuccess = (rawData, defaultMessage) => {
  const data = normalizeResponseData(rawData);

  const isFailure =
    data?.statusCode === "0" ||
    data?.status === "FAIL" ||
    data?.success === false ||
    Boolean(data?.error) ||
    Boolean(data?.rawMessage);

  if (isFailure) {
    throw new ApiError(
      502,
      decodeErrorMessage(data, defaultMessage),
      ERROR_CODES.GSP_AUTH_FAILED,
    );
  }

  return data;
};

// Step 1: Authenticate. `authToken` is the platform-level ClearTax token
// (one per software-vendor account, stored in .env — NOT per-organization).
// `data` is the base64-encoded { UserName, Password } issued when this
// organization's GSTIN was registered as a GSP with ClearTax on the NIC
// portal (per-organization credential, pulled from OrganizationGspCredential).
const authenticate = async ({ gstin, authToken, data }) => {
  try {
    const response = await axios.post(
      `${BASE_URL}${API_VERSION}/auth`,
      { Data: data },
      {
        headers: {
          Gstin: gstin,
          "X-CT-Auth-Token": authToken,
          "Content-Type": "application/json",
        },
      },
    );

    return assertSuccess(response.data, "ClearTax authentication failed");
    // returned object is expected to carry a session token (e.g. AuthToken/Sek) + expiry
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const description =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "ClearTax authentication failed";

    throw new ApiError(
      err?.response?.status || 502,
      description,
      ERROR_CODES.GSP_AUTH_FAILED,
    );
  }
};

// Step 2: Generate the E-Way Bill using the session token returned by authenticate().
const generate = async ({ gstin, authToken, payload }) => {
  try {
    const response = await axios.post(
      `${BASE_URL}${API_VERSION}/ewayapi`,
      payload,
      {
        headers: {
          Gstin: gstin,
          "X-CT-Auth-Token": authToken,
          "Content-Type": "application/json",
        },
      },
    );

    return assertSuccess(response.data, "E-Way Bill generation failed");
    // expected: { ewbNo, ewbDt, validUpto, signedQRCode, ... }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const description =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "E-Way Bill generation failed";

    throw new ApiError(
      err?.response?.status || 502,
      description,
      ERROR_CODES.EWAY_BILL_GENERATION_FAILED,
    );
  }
};

const cancel = async ({ gstin, authToken, ewbNo, reason }) => {
  try {
    const response = await axios.post(
      `${BASE_URL}${API_VERSION}/ewayapi`, // TODO: confirm cancel uses the same /ewayapi path with an action param, or its own path — check ClearTax's Sample API doc once sandbox access is available
      {
        action: "CANEWB",
        ewbNo,
        cancelRsnCode: reason || "1",
        cancelRmrk: "Cancelled via CloudeData",
      },
      {
        headers: {
          Gstin: gstin,
          "X-CT-Auth-Token": authToken,
          "Content-Type": "application/json",
        },
      },
    );

    return assertSuccess(response.data, "E-Way Bill cancellation failed");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const description =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "E-Way Bill cancellation failed";

    throw new ApiError(
      err?.response?.status || 502,
      description,
      ERROR_CODES.EWAY_BILL_CANCEL_FAILED,
    );
  }
};

module.exports = { authenticate, generate, cancel };
