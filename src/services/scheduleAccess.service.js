const ApiError = require("../utils/ApiError");
const { ERROR_CODES } = require("../constants/permissions");

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const getIstNow = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
};

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};

const assertMemberLoginAllowed = (member) => {
  if (!member) return;

  if (member.isSuspended) {
    throw new ApiError(
      403,
      "This account has been suspended by your organization admin",
      ERROR_CODES.ACCOUNT_SUSPENDED,
    );
  }

  const schedule = member.loginSchedule;
  if (!schedule?.enabled) return;

  const istNow = getIstNow();
  const dayKey = DAY_KEYS[istNow.getDay()];
  const dayRule = schedule.days?.[dayKey];

  if (!dayRule || !dayRule.enabled) {
    throw new ApiError(
      403,
      "Login is not allowed today per your organization's schedule",
      ERROR_CODES.OUTSIDE_LOGIN_SCHEDULE,
    );
  }

  const nowMinutes = istNow.getHours() * 60 + istNow.getMinutes();
  const fromMinutes = toMinutes(dayRule.from);
  const toMinutesVal = toMinutes(dayRule.to);

  if (nowMinutes < fromMinutes || nowMinutes > toMinutesVal) {
    throw new ApiError(
      403,
      `Login is only allowed between ${dayRule.from} and ${dayRule.to} today`,
      ERROR_CODES.OUTSIDE_LOGIN_SCHEDULE,
    );
  }
};

module.exports = { assertMemberLoginAllowed, DAY_KEYS };
