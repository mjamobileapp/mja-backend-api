const assert = require("node:assert/strict");
const test = require("node:test");
const ReportModel = require("../src/models/report");
const ReportController = require("../src/controller/report");

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test("report controller maps audit JSON and pagination metadata", async () => {
  const original = ReportModel.getAuditLogs;
  ReportModel.getAuditLogs = async () => ({ totalItems: 11, rows: [{ id: 154, userId: 12, username: "Budi Santoso", role: "admin", actionType: "UPDATE", entityName: "tbl_harga_cabang", entityId: 102, oldValues: '{"harga":15000}', newValues: { harga: 20000 }, ipAddress: null, userAgent: "agent", createdAt: "2026-07-19T14:30:00.000Z" }] });
  try {
    const res = response();
    await ReportController.getAuditLogs({ query: { page: "2", limit: "10" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.meta.totalPages, 2);
    assert.deepEqual(res.body.data.items[0].oldValues, { harga: 15000 });
    assert.deepEqual(res.body.data.items[0].newValues, { harga: 20000 });
  } finally { ReportModel.getAuditLogs = original; }
});

test("report controller returns typed not-found for an empty page", async () => {
  const original = ReportModel.getAuditLogs;
  ReportModel.getAuditLogs = async () => ({ totalItems: 0, rows: [] });
  try { await assert.rejects(ReportController.getAuditLogs({ query: {} }, response()), (error) => error.code === "DATA_NOT_FOUND" && error.statusCode === 404); }
  finally { ReportModel.getAuditLogs = original; }
});

test("report controller returns the financial summary response contract", async () => {
  const original = ReportModel.getSummary;
  const calls = [];
  ReportModel.getSummary = async (...args) => {
    calls.push(args);
    return { totalOmset: "15500000", totalPengeluaran: "3200000", pendapatanBersih: "12300000", jumlahOrder: "450" };
  };
  try {
    const res = response();
    await ReportController.getSummary({ query: { mitraId: "10", cabangId: "1", periode: "hari_ini" } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true,
      message: "Data ringkasan finansial berhasil diambil",
      data: { summary: { totalOmset: 15500000, totalPengeluaran: 3200000, pendapatanBersih: 12300000, jumlahOrder: 450 } },
    });
    assert.deepEqual(calls, [[10, 1, "hari_ini"]]);
  } finally { ReportModel.getSummary = original; }
});

test("report controller allows summary without tenant or branch filters", async () => {
  const original = ReportModel.getSummary;
  const calls = [];
  ReportModel.getSummary = async (...args) => {
    calls.push(args);
    return { totalOmset: 0, totalPengeluaran: 0, pendapatanBersih: 0, jumlahOrder: 0 };
  };
  try {
    const res = response();
    await ReportController.getSummary({ query: { periode: "last_month" } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [[undefined, undefined, "last_month"]]);
    assert.deepEqual(res.body.data.summary, { totalOmset: 0, totalPengeluaran: 0, pendapatanBersih: 0, jumlahOrder: 0 });
  } finally { ReportModel.getSummary = original; }
});

test("report controller returns the financial trend response contract", async () => {
  const original = ReportModel.getTrend;
  const calls = [];
  ReportModel.getTrend = async (...args) => {
    calls.push(args);
    return [{ date: "2026-07-01", omset: "950000" }, { date: "2026-07-02", omset: "1100000" }];
  };
  try {
    const res = response();
    await ReportController.getTrend({ query: { mitraId: "10", cabangId: "1", periode: "hari_ini" } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      success: true,
      message: "Data ringkasan finansial berhasil diambil",
      data: { trend: [{ date: "2026-07-01", omset: 950000 }, { date: "2026-07-02", omset: 1100000 }] },
    });
    assert.deepEqual(calls, [[10, 1, "hari_ini"]]);
  } finally { ReportModel.getTrend = original; }
});
