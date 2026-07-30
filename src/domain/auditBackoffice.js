const BACKOFFICE_AUDIT_ACTIONS = Object.freeze({
  LOGIN_SUCCESS: "LOGIN_SUCCESS", LOGIN_FAILED: "LOGIN_FAILED", LOGIN_BLOCKED: "LOGIN_BLOCKED",
  LOGOUT: "LOGOUT", CREATE: "CREATE", READ: "READ", UPDATE: "UPDATE", DELETE: "DELETE",
  RESTORE: "RESTORE", RESET_DATA: "RESET_DATA", CHANGE_PASSWORD: "CHANGE_PASSWORD",
  RESET_DEVICE: "RESET_DEVICE", RESET_PASSWORD: "RESET_PASSWORD", UPDATE_ACCESS: "UPDATE_ACCESS", STATUS_CHANGE: "STATUS_CHANGE",
  EXPORT_EXCEL: "EXPORT_EXCEL",
});

const BACKOFFICE_AUDIT_ENTITIES = Object.freeze({
  AUTHENTICATION: "backoffice_authentication", USER: "tbl_users", ROLE: "tbl_role", MENU: "tbl_menu",
  ACCESS: "tbl_akses", MITRA: "tbl_mitra", CABANG: "tbl_cabang", MACHINE_MASTER: "tbl_mesin_master",
  MACHINE_DETAIL: "tbl_mesin_detail", MASTER_ITEM: "tbl_master_item_expense", USER_OWNER: "tbl_users_mobile",
  APP_VERSION: "tbl_app_versions",
});

const SENSITIVE_KEYS = new Set(["password", "oldpassword", "newpassword", "confirmnewpassword", "confirmpassword", "token", "accesstoken", "refreshtoken", "authorization", "jwt", "secret", "clientsecret"]);
const limit = (value, max) => value == null ? null : String(value).slice(0, max);

const sanitizeAuditValue = (value, seen = new WeakSet()) => {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) throw new TypeError("Circular audit snapshot");
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map((item) => sanitizeAuditValue(item, seen)).filter((item) => item !== undefined);
  else {
    result = {};
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
      const sanitized = sanitizeAuditValue(item, seen);
      if (sanitized !== undefined) result[key] = sanitized;
    }
  }
  seen.delete(value);
  return result;
};

const normalizeActor = (actor = {}) => ({
  userId: actor.userId ?? actor.id ?? actor.id_user ?? null,
  username: limit(actor.username || "unknown", 100),
  role: limit(actor.roleName || actor.role || "unknown", 50),
});
const normalizeEntityId = (value) => value == null ? null : limit(value, 100);
const isBackofficeActor = (actor) => actor?.accountType === "backoffice" || actor?.tokenType === "backoffice";

module.exports = { BACKOFFICE_AUDIT_ACTIONS, BACKOFFICE_AUDIT_ENTITIES, sanitizeAuditValue, normalizeActor, normalizeEntityId, isBackofficeActor };
