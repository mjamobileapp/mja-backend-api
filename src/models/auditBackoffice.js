const dbPool = require("../config/database");

const createAuditBackofficeModel = (executor = dbPool) => ({
  async insertAudit(data) {
    const [result] = await executor.execute(
      `INSERT INTO tbl_audit_backoffice (userId, username, role, actionType, entityName, entityId, oldValues, newValues, ipAddress, userAgent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.userId ?? null, data.username, data.role, data.actionType, data.entityName, data.entityId ?? null,
        data.oldValues == null ? null : JSON.stringify(data.oldValues), data.newValues == null ? null : JSON.stringify(data.newValues),
        data.ipAddress ?? null, data.userAgent ?? null]
    );
    return result.insertId;
  },
});

const model = createAuditBackofficeModel();
module.exports = { ...model, createAuditBackofficeModel };
