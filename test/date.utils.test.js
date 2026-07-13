const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatJamWIB,
  formatTanggalJamWIB,
  formatTanggalWIB,
  getDatabaseTimestamp,
  getDateFilterCondition,
  getTodayStringYYYYMMDD,
} = require("../src/utils/date");

test("UTC timestamps are displayed in Asia/Jakarta across the midnight boundary", () => {
  const utcBeforeJakartaMidnight = new Date("2026-01-31T17:30:45.000Z");

  assert.equal(getDatabaseTimestamp(utcBeforeJakartaMidnight), "2026-01-31 17:30:45");
  assert.equal(getTodayStringYYYYMMDD(utcBeforeJakartaMidnight), "20260201");
  assert.equal(formatTanggalWIB("2026-01-31 17:30:45"), "01 FEBRUARI 2026");
  assert.equal(formatTanggalJamWIB("2026-01-31 17:30:45"), "01/02/2026 00:30 WIB");
  assert.equal(formatJamWIB("2026-01-31 17:30:45"), "00:30 WIB");
});

test("date filters calculate Jakarta calendar days from UTC storage", () => {
  const jakartaDate = "DATE(CONVERT_TZ(o.waktuOrder, '+00:00', '+07:00'))";
  const jakartaToday = "DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'))";

  assert.equal(getDateFilterCondition("o.waktuOrder", "hari_ini"), `${jakartaDate} = ${jakartaToday}`);
  assert.equal(getDateFilterCondition("o.waktuOrder", "kemarin"), `${jakartaDate} = ${jakartaToday} - INTERVAL 1 DAY`);
});
