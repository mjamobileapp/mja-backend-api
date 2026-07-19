const { recordBackofficeAudit } = require("../services/auditBackoffice");
const { BACKOFFICE_AUDIT_ACTIONS: A, BACKOFFICE_AUDIT_ENTITIES: E } = require("../domain/auditBackoffice");
const audit = (req, actionType, entityName, entityId, oldValues, newValues) => recordBackofficeAudit({ req, actionType, entityName, entityId, oldValues, newValues });
const getAuditSnapshot = async (model, method, id) => {
  if (typeof model?.[method] !== "function") return null;
  let result;
  try { result = await model[method](id); } catch (_) { return null; }
  if (Array.isArray(result)) {
    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows[0] || null;
  }
  return result?.data?.[0] || result?.data || result || null;
};
module.exports = { audit, getAuditSnapshot, A, E };
