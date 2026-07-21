const dbPool = require("../config/database");

const buildAuditWhere = (filters) => {
  const clauses = [];
  const values = [];
  if (filters.actionType) {
    clauses.push("actionType = ?");
    values.push(filters.actionType);
  }
  if (filters.entityName) {
    clauses.push("entityName = ?");
    values.push(filters.entityName);
  }
  if (filters.startDateTime) {
    clauses.push("createdAt >= ?");
    values.push(filters.startDateTime);
  }
  if (filters.endDateTimeExclusive) {
    clauses.push("createdAt < ?");
    values.push(filters.endDateTimeExclusive);
  }
  return {
    whereSql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
};

const createReportModel = (executor = dbPool) => ({
  async getAuditLogs(filters) {
    const where = buildAuditWhere(filters);
    const [countRows] = await executor.execute(
      `SELECT COUNT(*) AS totalItems FROM tbl_audit_backoffice${where.whereSql}`,
      where.values
    );
    // LIMIT/OFFSET berasal dari parser integer positif dengan batas maksimum,
    // sehingga aman disisipkan sebagai numeric literals. Sebagian versi
    // MySQL/MariaDB menolak LIMIT/OFFSET sebagai parameter binary protocol
    // dan menghasilkan ER_WRONG_ARGUMENTS pada prepared statement.
    const [rows] = await executor.execute(
      `SELECT id, userId, username, role, actionType, entityName, entityId,
              oldValues, newValues, ipAddress, userAgent, createdAt
       FROM tbl_audit_backoffice${where.whereSql}
       ORDER BY createdAt DESC, id DESC
       LIMIT ${filters.limit} OFFSET ${filters.offset}`,
      where.values
    );
    return { rows, totalItems: Number(countRows[0]?.totalItems || 0) };
  },
});

module.exports = { ...createReportModel(), createReportModel, buildAuditWhere };
