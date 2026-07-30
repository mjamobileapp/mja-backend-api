const { BACKOFFICE_AUDIT_ACTIONS } = require("./auditBackoffice");
const { createHttpError } = require("../utils/httpError");

const MAX_LIMIT = 100;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const invalidFilter = (message) => {
  throw createHttpError(400, message, "AUDIT_LOG_FILTER_INVALID");
};

const getSingleQueryValue = (value, name) => {
  if (Array.isArray(value)) invalidFilter(`${name} hanya boleh dikirim satu kali`);
  return value;
};

const parsePositiveInteger = (value, name, defaultValue, max = Number.MAX_SAFE_INTEGER) => {
  if (value == null || value === "") return defaultValue;
  const rawValue = getSingleQueryValue(value, name);
  if (typeof rawValue !== "string" || !/^\d+$/.test(rawValue.trim())) {
    invalidFilter(`${name} harus berupa integer positif`);
  }
  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    invalidFilter(max === Number.MAX_SAFE_INTEGER
      ? `${name} harus berupa integer positif`
      : `${name} harus berupa integer antara 1 dan ${max}`);
  }
  return parsed;
};

const parseDate = (value, name) => {
  if (value == null || value === "") return null;
  const rawValue = getSingleQueryValue(value, name);
  if (typeof rawValue !== "string" || !DATE_PATTERN.test(rawValue)) {
    invalidFilter(`${name} harus menggunakan format YYYY-MM-DD`);
  }
  const [, year, month, day] = rawValue.match(DATE_PATTERN);
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    invalidFilter(`${name} bukan tanggal yang valid`);
  }
  return { rawValue, date };
};

const toSqlDateTime = (date) => date.toISOString().slice(0, 19).replace("T", " ");

const parseAuditLogQuery = (query = {}) => {
  const page = parsePositiveInteger(query.page, "page", 1);
  const limit = parsePositiveInteger(query.limit, "limit", 10, MAX_LIMIT);
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) invalidFilter("kombinasi page dan limit terlalu besar");

  const actionTypeValue = getSingleQueryValue(query.actionType, "actionType");
  const actionType = actionTypeValue == null ? null : String(actionTypeValue).trim().toUpperCase();
  if (actionTypeValue != null && !actionType) invalidFilter("actionType tidak boleh kosong");
  if (actionType && !Object.values(BACKOFFICE_AUDIT_ACTIONS).includes(actionType)) invalidFilter("actionType tidak valid");

  const entityNameValue = getSingleQueryValue(query.entityName, "entityName");
  const entityName = entityNameValue == null ? null : String(entityNameValue).trim();
  if (entityNameValue != null && !entityName) invalidFilter("entityName tidak boleh kosong");
  if (entityName && entityName.length > 100) invalidFilter("entityName maksimal 100 karakter");

  const startDate = parseDate(query.startDate, "startDate");
  const endDate = parseDate(query.endDate, "endDate");
  if (startDate && endDate && startDate.date > endDate.date) invalidFilter("startDate tidak boleh lebih besar dari endDate");

  const endDateExclusive = endDate ? new Date(endDate.date.getTime() + 24 * 60 * 60 * 1000) : null;
  return {
    page,
    limit,
    offset,
    actionType: actionType || null,
    entityName: entityName || null,
    startDateTime: startDate ? toSqlDateTime(startDate.date) : null,
    endDateTimeExclusive: endDateExclusive ? toSqlDateTime(endDateExclusive) : null,
  };
};

module.exports = { MAX_LIMIT, parseAuditLogQuery };
