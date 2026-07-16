const MOBILE_ROLES = Object.freeze({
  OWNER: "owner",
  KASIR: "kasir",
});

const ACCOUNT_TYPES = Object.freeze({
  BACKOFFICE: "backoffice",
  OWNER: MOBILE_ROLES.OWNER,
  KASIR: MOBILE_ROLES.KASIR,
});

const normalizeMobileRole = (value) =>
  String(value || "").trim().toLowerCase();

const isMobileRole = (value) =>
  Object.values(MOBILE_ROLES).includes(normalizeMobileRole(value));

module.exports = {
  ACCOUNT_TYPES,
  MOBILE_ROLES,
  isMobileRole,
  normalizeMobileRole,
};
