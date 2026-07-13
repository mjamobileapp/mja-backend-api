const REQUIRED_SERVER_ENV = ["JWT_SECRET", "DB_HOST", "DB_USERNAME", "DB_NAME"];

const getMissingServerEnv = (environment = process.env) =>
  REQUIRED_SERVER_ENV.filter((name) => !String(environment[name] || "").trim());

const validateServerEnvironment = (environment = process.env) => {
  const missing = getMissingServerEnv(environment);

  if (missing.length > 0) {
    throw new Error(`Konfigurasi environment belum lengkap: ${missing.join(", ")}`);
  }
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

module.exports = {
  getAllowedOrigins,
  getMissingServerEnv,
  validateServerEnvironment,
};
