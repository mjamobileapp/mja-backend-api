const assert = require("node:assert/strict");
const test = require("node:test");
const { createReportModel } = require("../src/models/report");

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
