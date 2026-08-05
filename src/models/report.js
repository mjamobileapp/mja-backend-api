const dbPool = require("../config/database");
const { getDateFilterCondition, getJakartaSqlDate } = require("../utils/date");
const { createHttpError } = require("../utils/httpError");

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

const isProvided = (value) => value !== undefined && value !== null && value !== "";

const buildSummaryWhere = (mitraId, cabangId, dateFilter) => {
  const clauses = ["1=1"];
  const values = [];

  if (isProvided(mitraId)) {
    clauses.push("idMitra = ?");
    values.push(mitraId);
  }
  if (isProvided(cabangId)) {
    clauses.push("cabangId = ?");
    values.push(cabangId);
  }

  clauses.push(dateFilter);
  return { sql: clauses.join(" AND "), values };
};

const createReportModel = (executor = dbPool) => ({
  async getTrend(mitraId, cabangId, periode) {
    const dateFilter = getDateFilterCondition("waktuOrder", periode);
    const trendWhere = buildSummaryWhere(mitraId, cabangId, dateFilter);
    const dateGroup = getJakartaSqlDate("waktuOrder");
    const [rows] = await executor.execute(
      `SELECT
        ${dateGroup} AS date,
        IFNULL(SUM(totalBayar), 0) AS omset
       FROM tbl_order_laundry
       WHERE ${trendWhere.sql}
       GROUP BY ${dateGroup}
       ORDER BY date ASC`,
      trendWhere.values
    );

    if (rows.length === 0) {
      throw createHttpError(404, "data not found", "DATA_NOT_FOUND");
    }

    return rows;
  },
  async getSummary(mitraId, cabangId, periode) {
    const orderDateFilter = getDateFilterCondition("waktuOrder", periode);
    const expenseDateFilter = getDateFilterCondition("waktuPengeluaran", periode);
    const orderWhere = buildSummaryWhere(mitraId, cabangId, orderDateFilter);
    const expenseWhere = buildSummaryWhere(mitraId, cabangId, expenseDateFilter);
    const [rows] = await executor.execute(
      `SELECT
        IFNULL(Omset.totalOmset, 0) AS totalOmset,
        IFNULL(Omset.jumlahOrder, 0) AS jumlahOrder,
        IFNULL(Pengeluaran.totalPengeluaran, 0) AS totalPengeluaran,
        (IFNULL(Omset.totalOmset, 0) - IFNULL(Pengeluaran.totalPengeluaran, 0)) AS pendapatanBersih
       FROM (
         SELECT
           SUM(totalBayar) AS totalOmset,
           COUNT(id) AS jumlahOrder
         FROM tbl_order_laundry
         WHERE ${orderWhere.sql}
       ) AS Omset
       CROSS JOIN (
         SELECT SUM(nominal) AS totalPengeluaran
         FROM tbl_pengeluaran
         WHERE ${expenseWhere.sql}
           AND statusAktif = 1
       ) AS Pengeluaran`,
      [...orderWhere.values, ...expenseWhere.values]
    );

    if (rows.length === 0) {
      throw createHttpError(404, "data not found", "DATA_NOT_FOUND");
    }

    return rows[0];
  },
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

module.exports = { ...createReportModel(), createReportModel, buildAuditWhere, buildSummaryWhere };
