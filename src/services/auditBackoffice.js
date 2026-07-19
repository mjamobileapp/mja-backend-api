const { BACKOFFICE_AUDIT_ACTIONS, BACKOFFICE_AUDIT_ENTITIES, sanitizeAuditValue, normalizeActor, normalizeEntityId } = require("../domain/auditBackoffice");
const { insertAudit } = require("../models/auditBackoffice");

const createBackofficeAuditRecorder = ({ insertAudit: save = insertAudit, logger = console } = {}) => async (event = {}) => {
  const actionType = event.actionType;
  const entityName = event.entityName;
  if (!Object.values(BACKOFFICE_AUDIT_ACTIONS).includes(actionType) || !Object.values(BACKOFFICE_AUDIT_ENTITIES).includes(entityName)) return false;
  try {
    const req = event.req;
    const actor = normalizeActor(event.actor || req?.user);
    return Boolean(await save({
      userId: actor.userId, username: actor.username, role: actor.role, actionType, entityName,
      entityId: normalizeEntityId(event.entityId), oldValues: event.oldValues == null ? null : sanitizeAuditValue(event.oldValues),
      newValues: event.newValues == null ? null : sanitizeAuditValue(event.newValues),
      ipAddress: limit(req?.ip || req?.socket?.remoteAddress, 45), userAgent: limit(req?.get?.("user-agent"), 1000),
    }));
  } catch (error) {
    logger.error("Backoffice audit insert failed", { actionType, entityName, entityId: normalizeEntityId(event.entityId), message: error.message });
    return false;
  }
};
const limit = (v, n) => v == null ? null : String(v).slice(0, n);
const recordBackofficeAudit = createBackofficeAuditRecorder();
module.exports = { createBackofficeAuditRecorder, recordBackofficeAudit };
