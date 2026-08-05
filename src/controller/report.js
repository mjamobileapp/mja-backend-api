const ReportModel = require("../models/report");
const { parseAuditLogQuery } = require("../domain/reportAudit");
const { createHttpError } = require("../utils/httpError");

const parsePositiveIntegerQuery = (value, name) => {
  if (Array.isArray(value) || value == null || String(value).trim() === "" || !/^\d+$/.test(String(value).trim()) || Number(value) < 1) {
    throw createHttpError(400, `${name} harus berupa integer positif`, "REPORT_FILTER_INVALID");
  }
  return Number(value);
};

const parseOptionalPositiveIntegerQuery = (value, name) => {
  if (value == null || value === "") return undefined;
  return parsePositiveIntegerQuery(value, name);
};

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

const mapTrendRow = (row) => ({
  date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
  omset: Number(row.omset) || 0,
});

const getAuditLogs = async (req, res) => {
  const filters = parseAuditLogQuery(req.query);
  const { rows, totalItems } = await ReportModel.getAuditLogs(filters);
  if (totalItems === 0 || rows.length === 0) {
    throw createHttpError(404, "data not found", "DATA_NOT_FOUND");
  }
  return res.status(200).json({
    success: true,
    message: "Berhasil mengambil data log aktivitas user",
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

const getSummary = async (req, res) => {
  const mitraId = parseOptionalPositiveIntegerQuery(req.query.mitraId, "mitraId");
  const cabangId = parseOptionalPositiveIntegerQuery(req.query.cabangId, "cabangId");
  const periode = Array.isArray(req.query.periode) ? null : String(req.query.periode || "").trim();

  if (!periode) {
    throw createHttpError(400, "periode wajib diisi", "REPORT_FILTER_INVALID");
  }

  const row = await ReportModel.getSummary(mitraId, cabangId, periode);
  const summary = {
    totalOmset: Number(row.totalOmset) || 0,
    totalPengeluaran: Number(row.totalPengeluaran) || 0,
    pendapatanBersih: Number(row.pendapatanBersih) || 0,
    jumlahOrder: Number(row.jumlahOrder) || 0,
  };

  return res.status(200).json({
    success: true,
    message: "Data ringkasan finansial berhasil diambil",
    data: { summary },
  });
};

const getTrend = async (req, res) => {
  const mitraId = parseOptionalPositiveIntegerQuery(req.query.mitraId, "mitraId");
  const cabangId = parseOptionalPositiveIntegerQuery(req.query.cabangId, "cabangId");
  const periode = Array.isArray(req.query.periode) ? null : String(req.query.periode || "").trim();

  if (!periode) {
    throw createHttpError(400, "periode wajib diisi", "REPORT_FILTER_INVALID");
  }

  const rows = await ReportModel.getTrend(mitraId, cabangId, periode);

  return res.status(200).json({
    success: true,
    message: "Data ringkasan finansial berhasil diambil",
    data: { trend: rows.map(mapTrendRow) },
  });
};

module.exports = {
  getAuditLogs,
  getSummary,
  getTrend,
  mapAuditLogRow,
  mapTrendRow,
  parseJsonColumn,
  parsePositiveIntegerQuery,
  parseOptionalPositiveIntegerQuery,
};
