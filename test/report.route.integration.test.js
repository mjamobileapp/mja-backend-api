require("dotenv").config();

const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const test = require("node:test");
const dbPool = require("../src/config/database");
const { createApp } = require("../src/app");

const request = (server, token, path) => new Promise((resolve, reject) => {
  const address = server.address();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const req = http.request({ host: "127.0.0.1", port: address.port, path, method: "GET", headers }, (res) => {
    let body = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => resolve({ statusCode: res.statusCode, body: JSON.parse(body) }));
  });
  req.on("error", reject);
  req.end();
});

test("audit report route enforces auth and returns a backoffice audit page", async () => {
  const originalExecute = dbPool.execute;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = originalSecret || "report-route-test-secret";
  const calls = [];
  dbPool.execute = async (query, values) => {
    calls.push({ query, values });
    if (/SELECT\s+u\.id/i.test(query)) return [[{ id: 12, role: 1, roleName: "admin", username: "admin", statusAktif: 1 }], {}];
    if (/SELECT COUNT\(\*\)/i.test(query)) return [[{ totalItems: 1 }], {}];
    return [[{
      id: 154, userId: 12, username: "Budi Santoso", role: "admin", actionType: "UPDATE",
      entityName: "tbl_harga_cabang", entityId: "102", oldValues: '{"harga":15000}', newValues: '{"harga":20000}',
      ipAddress: "127.0.0.1", userAgent: "integration-test", createdAt: new Date("2026-07-19T14:30:00.000Z"),
    }], {}];
  };
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => { server.once("listening", () => { resolve(); }); });
  const mobileToken = jwt.sign({ id: 12, username: "admin", role: 1, tokenType: "mobile" }, process.env.JWT_SECRET);
  const backofficeToken = jwt.sign({ id: 12, username: "admin", role: 1, tokenType: "backoffice" }, process.env.JWT_SECRET);
  try {
    const noToken = await request(server, null, "/api/report/audit-logs");
    assert.equal(noToken.statusCode, 401);

    const mobile = await request(server, mobileToken, "/api/report/audit-logs");
    assert.equal(mobile.statusCode, 401);

    const success = await request(server, backofficeToken, "/api/report/audit-logs?page=1&limit=10&actionType=UPDATE&entityName=tbl_harga_cabang&startDate=2026-07-01&endDate=2026-07-31");
    assert.equal(success.statusCode, 200);
    assert.equal(success.body.data.items[0].entityName, "tbl_harga_cabang");
    assert.equal(success.body.data.meta.totalItems, 1);
    assert.equal(calls.some(({ query }) => /FROM tbl_audit_backoffice/i.test(query)), true);
  } finally {
    await new Promise((resolve) => { server.close(() => { resolve(); }); });
    dbPool.execute = originalExecute;
    process.env.JWT_SECRET = originalSecret;
  }
});
