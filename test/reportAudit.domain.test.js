const assert = require("node:assert/strict");
const test = require("node:test");
const { BACKOFFICE_AUDIT_ACTIONS } = require("../src/domain/auditBackoffice");
const { parseAuditLogQuery } = require("../src/domain/reportAudit");

test("audit report query uses safe pagination defaults and offset", () => {
  assert.deepEqual(parseAuditLogQuery({}), {
    page: 1, limit: 10, offset: 0, actionType: null, entityName: null,
    startDateTime: null, endDateTimeExclusive: null,
  });
  assert.equal(parseAuditLogQuery({ page: "2", limit: "25" }).offset, 25);
});

test("audit report query validates action/entity/date filters", () => {
  assert.equal(parseAuditLogQuery({ actionType: " update ", entityName: " tbl_harga_cabang " }).actionType, "UPDATE");
  assert.equal(parseAuditLogQuery({ actionType: "UPDATE", entityName: "tbl_harga_cabang" }).entityName, "tbl_harga_cabang");
  for (const actionType of Object.values(BACKOFFICE_AUDIT_ACTIONS)) {
    assert.equal(parseAuditLogQuery({ actionType }).actionType, actionType);
  }
  const result = parseAuditLogQuery({ startDate: "2026-07-01", endDate: "2026-07-31" });
  assert.equal(result.startDateTime, "2026-07-01 00:00:00");
  assert.equal(result.endDateTimeExclusive, "2026-08-01 00:00:00");
});

test("audit report query rejects invalid values", () => {
  for (const query of [{ page: "0" }, { limit: "101" }, { page: "1.5" }, { actionType: "NOPE" }, { entityName: " " }, { startDate: "2026-02-29" }, { endDate: "2026-07-01", startDate: "2026-07-02" }]) {
    assert.throws(() => parseAuditLogQuery(query), (error) => error.code === "AUDIT_LOG_FILTER_INVALID");
  }
});
