const ReportModel = require("../models/report");
const { parseAuditLogQuery } = require("../domain/reportAudit");
const { createHttpError } = require("../utils/httpError");

const parseJsonColumn = (value) => {
  if (value == null || typeof value === "object") return value ?? null;
  return JSON.parse(value);
};

const toIsoString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid audit createdAt value");
  return date.toISOString();
};

const mapAuditLogRow = (row) => ({
  id: Number(row.id),
  userId: row.userId == null ? null : Number(row.userId),
  username: row.username,
  role: row.role,
  actionType: row.actionType,
  entityName: row.entityName,
  entityId: row.entityId == null ? null : String(row.entityId),
  oldValues: parseJsonColumn(row.oldValues),
  newValues: parseJsonColumn(row.newValues),
  ipAddress: row.ipAddress ?? null,
  userAgent: row.userAgent ?? null,
  createdAt: toIsoString(row.createdAt),
});

const getAuditLogs = async (req, res) => {
  const filters = parseAuditLogQuery(req.query);
  const { rows, totalItems } = await ReportModel.getAuditLogs(filters);
  if (totalItems === 0 || rows.length === 0) {
    throw createHttpError(404, "data not found", "DATA_NOT_FOUND");
  }
  return res.status(200).json({
    success: true,
    message: "Berhasil mengambil data audit trail",
    data: {
      items: rows.map(mapAuditLogRow),
      meta: {
        totalItems,
        itemsPerPage: filters.limit,
        currentPage: filters.page,
        totalPages: Math.ceil(totalItems / filters.limit),
      },
    },
  });
};

module.exports = { getAuditLogs, mapAuditLogRow, parseJsonColumn };
