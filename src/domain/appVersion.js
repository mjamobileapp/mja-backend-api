const { createHttpError } = require("../utils/httpError");
const { isMissingValue } = require("../utils/validation");
const { URL } = require("node:url");

const APP_VERSION_PLATFORMS = Object.freeze({ ANDROID: "android", IOS: "ios" });
const APP_VERSION_REQUIRED_FIELDS = Object.freeze([
  "platform",
  "latestVersion",
  "minRequiredVersion",
  "storeUrl",
]);
const PUBLIC_FIELDS = Object.freeze([
  "latestVersion",
  "minRequiredVersion",
  "storeUrl",
  "releaseNotes",
]);

const invalid = (message) => createHttpError(400, message, "APP_VERSION_VALIDATION_ERROR");

const normalizeString = (value) => (typeof value === "string" ? value.trim() : value);

const normalizeAppVersionPayload = (body) => {
  if (!Array.isArray(body?.versions) || body.versions.length === 0) {
    return { missingFields: ["versions"] };
  }

  const missingFields = [];
  const normalized = [];
  const seenPlatforms = new Set();

  body.versions.forEach((item) => {
    const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    for (const field of APP_VERSION_REQUIRED_FIELDS) {
      if (isMissingValue(source[field]) && !missingFields.includes(field)) missingFields.push(field);
    }

    const platform = normalizeString(source.platform);
    if (platform && !Object.values(APP_VERSION_PLATFORMS).includes(platform)) {
      throw invalid("platform harus bernilai android atau ios");
    }
    if (platform && seenPlatforms.has(platform)) throw invalid("platform tidak boleh duplikat");
    if (platform) seenPlatforms.add(platform);

    for (const field of ["latestVersion", "minRequiredVersion"]) {
      const value = normalizeString(source[field]);
      if (!isMissingValue(value) && (typeof value !== "string" || value.length > 20)) {
        throw invalid(`${field} harus berupa string maksimal 20 karakter`);
      }
    }

    const storeUrl = normalizeString(source.storeUrl);
    if (!isMissingValue(storeUrl)) {
      if (typeof storeUrl !== "string") throw invalid("storeUrl harus berupa URL HTTP atau HTTPS");
      let parsedUrl;
      try { parsedUrl = new URL(storeUrl); } catch (_) { throw invalid("storeUrl harus berupa URL HTTP atau HTTPS"); }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw invalid("storeUrl harus berupa URL HTTP atau HTTPS");
    }

    const releaseNotes = source.releaseNotes == null ? null : normalizeString(source.releaseNotes);
    if (releaseNotes !== null && typeof releaseNotes !== "string") throw invalid("releaseNotes harus berupa string atau null");
    normalized.push({
      platform,
      latestVersion: normalizeString(source.latestVersion),
      minRequiredVersion: normalizeString(source.minRequiredVersion),
      storeUrl,
      releaseNotes,
    });
  });

  if (missingFields.length > 0) return { missingFields };
  return { versions: normalized };
};

const mapAppVersionRows = (rows = []) => rows.reduce((result, row) => {
  if (!row?.platform) return result;
  result[row.platform] = PUBLIC_FIELDS.reduce((version, field) => {
    version[field] = row[field] ?? null;
    return version;
  }, {});
  return result;
}, {});

module.exports = {
  APP_VERSION_PLATFORMS,
  APP_VERSION_REQUIRED_FIELDS,
  normalizeAppVersionPayload,
  mapAppVersionRows,
};
