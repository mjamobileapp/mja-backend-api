const assert = require("node:assert/strict");
const test = require("node:test");
const { createReportModel } = require("../src/models/report");

test("report model returns a date-grouped financial trend with dynamic scope filters", async () => {
  const calls = [];
  const executor = { execute: async (query, values) => {
    calls.push({ query, values });
    return [[{ date: "2026-07-01", omset: "950000" }, { date: "2026-07-02", omset: "1100000" }], {}];
  } };
  const model = createReportModel(executor);

  const result = await model.getTrend(10, 1, "hari_ini");

  assert.deepEqual(result, [{ date: "2026-07-01", omset: "950000" }, { date: "2026-07-02", omset: "1100000" }]);
  assert.match(calls[0].query, /FROM tbl_order_laundry/);
  assert.match(calls[0].query, /WHERE 1=1 AND idMitra = \? AND cabangId = \?/);
  assert.match(calls[0].query, /GROUP BY DATE\(CONVERT_TZ\(waktuOrder/);
  assert.match(calls[0].query, /ORDER BY date ASC/);
  assert.deepEqual(calls[0].values, [10, 1]);
});

test("report model returns financial summary with scoped date filters", async () => {
  const calls = [];
  const executor = { execute: async (query, values) => {
    calls.push({ query, values });
    return [[{ totalOmset: "15500000.00", totalPengeluaran: "3200000.00", pendapatanBersih: "12300000.00", jumlahOrder: "450" }], {}];
  } };
  const model = createReportModel(executor);

  const result = await model.getSummary(10, 1, "hari_ini");

  assert.deepEqual(result, {
    totalOmset: "15500000.00",
    totalPengeluaran: "3200000.00",
    pendapatanBersih: "12300000.00",
    jumlahOrder: "450",
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /FROM tbl_order_laundry[\s\S]*waktuOrder/);
  assert.match(calls[0].query, /FROM tbl_pengeluaran[\s\S]*waktuPengeluaran/);
  assert.match(calls[0].query, /statusAktif = 1/);
  assert.deepEqual(calls[0].values, [10, 1, 10, 1]);
  assert.match(calls[0].query, /WHERE 1=1 AND idMitra = \? AND cabangId = \?/g);
});

test("report model omits optional summary scope filters when params are absent", async () => {
  const calls = [];
  const executor = { execute: async (query, values) => {
    calls.push({ query, values });
    return [[{ totalOmset: 0, totalPengeluaran: 0, pendapatanBersih: 0, jumlahOrder: 0 }], {}];
  } };
  const model = createReportModel(executor);

  await model.getSummary(undefined, undefined, "bulan_lalu");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].query.includes("idMitra = ?"), false);
  assert.equal(calls[0].query.includes("cabangId = ?"), false);
  assert.match(calls[0].query, /WHERE 1=1 AND YEAR\(DATE\(CONVERT_TZ\(waktuOrder/);
  assert.match(calls[0].query, /WHERE 1=1 AND YEAR\(DATE\(CONVERT_TZ\(waktuPengeluaran/);
  assert.deepEqual(calls[0].values, []);
});

test("report model uses the same parameterized filters for count and data", async () => {
  const calls = [];
  const executor = { execute: async (query, values) => {
    calls.push({ query, values });
    return calls.length === 1 ? [[{ totalItems: "2" }], {}] : [[{ id: 2, createdAt: new Date() }], {}];
  } };
  const model = createReportModel(executor);
  const result = await model.getAuditLogs({ actionType: "UPDATE", entityName: "tbl_harga_cabang", startDateTime: "2026-07-01 00:00:00", endDateTimeExclusive: "2026-08-01 00:00:00", limit: 10, offset: 0 });
  assert.equal(result.totalItems, 2);
  assert.equal(calls.length, 2);
  assert.match(calls[0].query, /FROM tbl_audit_backoffice/);
  assert.match(calls[1].query, /ORDER BY createdAt DESC, id DESC/);
  assert.match(calls[1].query, /LIMIT 10 OFFSET 0/);
  assert.deepEqual(calls[0].values, ["UPDATE", "tbl_harga_cabang", "2026-07-01 00:00:00", "2026-08-01 00:00:00"]);
  assert.deepEqual(calls[1].values, calls[0].values);
});
