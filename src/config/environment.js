const REQUIRED_SERVER_ENV = ["JWT_SECRET", "DB_HOST", "DB_USERNAME", "DB_NAME"];
const DEFAULT_PUBLIC_AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_PUBLIC_AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;
const DEFAULT_EMAIL_SEND_TIMEOUT_MS = 15 * 1000;

const getPositiveInteger = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const getMissingServerEnv = (environment = process.env) =>
  REQUIRED_SERVER_ENV.filter((name) => !String(environment[name] || "").trim());

const validateServerEnvironment = (environment = process.env) => {
  const missing = getMissingServerEnv(environment);

  if (missing.length > 0) {
    throw new Error(`Konfigurasi environment belum lengkap: ${missing.join(", ")}`);
  }
};

const getRequiredJwtSecret = (environment = process.env) => {
  const jwtSecret = String(environment.JWT_SECRET || "").trim();

  if (!jwtSecret) {
    throw new Error("Konfigurasi environment belum lengkap: JWT_SECRET");
  }

  return jwtSecret;
};

const getAllowedOrigins = (environment = process.env) => {
  const configuredOrigins = String(environment.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return [
    "http://localhost:3000",
    "http://localhost:3100",
    "http://dev.appadentis.cloud",
    "http://appadentis.cloud",
    "https://appadentis.cloud",
    "http://148.230.102.45:3100",
  ];
};

const getTrustProxy = (environment = process.env) => {
  const trustProxy = String(environment.TRUST_PROXY || "").trim().toLowerCase();
  return trustProxy === "true" || trustProxy === "1";
};

const getPublicAuthRateLimitConfig = (environment = process.env) => ({
  windowMs: getPositiveInteger(
    environment.PUBLIC_AUTH_RATE_LIMIT_WINDOW_MS,
    DEFAULT_PUBLIC_AUTH_RATE_LIMIT_WINDOW_MS
  ),
  maxAttempts: getPositiveInteger(
    environment.PUBLIC_AUTH_RATE_LIMIT_MAX,
    DEFAULT_PUBLIC_AUTH_RATE_LIMIT_MAX_ATTEMPTS
  ),
});

const getEmailSendTimeoutMs = (environment = process.env) =>
  getPositiveInteger(environment.EMAIL_SEND_TIMEOUT_MS, DEFAULT_EMAIL_SEND_TIMEOUT_MS);

module.exports = {
  getAllowedOrigins,
  getEmailSendTimeoutMs,
  getMissingServerEnv,
  getPublicAuthRateLimitConfig,
  getRequiredJwtSecret,
  getTrustProxy,
  validateServerEnvironment,
};
