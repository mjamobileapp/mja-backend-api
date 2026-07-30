const { BACKOFFICE_AUDIT_ACTIONS, BACKOFFICE_AUDIT_ENTITIES, sanitizeAuditValue, normalizeActor, normalizeEntityId } = require("../domain/auditBackoffice");
const { insertAudit } = require("../models/auditBackoffice");
const globalLogger = require("../utils/logger");

const limit = (v, n) => v == null ? null : String(v).slice(0, n);

const buildBackofficeAuditData = (event = {}) => {
  const req = event.req;
  const actor = normalizeActor(event.actor || req?.user);
  return {
    userId: actor.userId,
    username: actor.username,
    role: actor.role,
    actionType: event.actionType,
    entityName: event.entityName,
    entityId: normalizeEntityId(event.entityId),
    oldValues: event.oldValues == null ? null : sanitizeAuditValue(event.oldValues),
    newValues: event.newValues == null ? null : sanitizeAuditValue(event.newValues),
    ipAddress: limit(req?.ip || req?.socket?.remoteAddress, 45),
    userAgent: limit(req?.get?.("user-agent"), 1000),
  };
};

const createBackofficeAuditRecorder = ({ insertAudit: save = insertAudit, logger = globalLogger } = {}) => async (event = {}) => {
  const actionType = event.actionType;
  const entityName = event.entityName;
  if (!Object.values(BACKOFFICE_AUDIT_ACTIONS).includes(actionType) || !Object.values(BACKOFFICE_AUDIT_ENTITIES).includes(entityName)) return false;
  try {
    return Boolean(await save(buildBackofficeAuditData(event)));
  } catch (error) {
    const requestLogger = event.logger || event.req?.log || logger;
    requestLogger.error(
      {
        err: error,
        event: "backoffice_audit_insert_failed",
        actionType,
        entityName,
        entityId: normalizeEntityId(event.entityId),
      },
      "Backoffice audit insert failed"
    );
    return false;
  }
};
const recordBackofficeAudit = createBackofficeAuditRecorder();
module.exports = { buildBackofficeAuditData, createBackofficeAuditRecorder, recordBackofficeAudit };
