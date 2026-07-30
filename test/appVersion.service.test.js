const assert = require("node:assert/strict");
const test = require("node:test");
const { createAppVersionService } = require("../src/services/appVersion");

const createConnection = (calls, failAudit = false) => ({
  async execute(sql, values) {
    calls.push({ type: "execute", sql, values });
    if (/INSERT INTO tbl_audit_backoffice/.test(sql) && failAudit) throw new Error("audit failed");
    if (/tbl_app_versions/.test(sql) && /SELECT/.test(sql)) {
      if (/FOR UPDATE/.test(sql)) return [[{ platform: "android", latestVersion: "1.4.0", minRequiredVersion: "1.3.0", storeUrl: "https://old.test", releaseNotes: null }]];
      return [[{ platform: "android", latestVersion: "1.5.0", minRequiredVersion: "1.4.2", storeUrl: "https://new.test", releaseNotes: "new" }]];
    }
    return [{ insertId: 1 }];
  },
});

const createTransaction = (connection, calls) => async (work) => {
  calls.push("begin");
  try {
    const result = await work(connection);
    calls.push("commit");
    return result;
  } catch (error) {
    calls.push("rollback");
    throw error;
  } finally {
    calls.push("release");
  }
};

const createFactories = (connection) => ({
  appVersionModelFactory: (executor) => ({
    getAllAppVersions: (options) => executor.execute(options?.forUpdate ? "SELECT * FROM tbl_app_versions FOR UPDATE" : "SELECT * FROM tbl_app_versions").then(([rows]) => rows),
    upsertAppVersion: (version, updatedBy) => executor.execute("INSERT INTO tbl_app_versions", [version, updatedBy]),
  }),
  auditModelFactory: (executor) => ({
    insertAudit: (data) => executor.execute("INSERT INTO tbl_audit_backoffice", [data]),
  }),
});

const versions = [{ platform: "android", latestVersion: "1.5.0", minRequiredVersion: "1.4.2", storeUrl: "https://new.test", releaseNotes: "new" }];

test("app version update commits version writes and audit on one transaction", async () => {
  const calls = [];
  const connection = createConnection(calls);
  const service = createAppVersionService({
    transaction: createTransaction(connection, calls),
    ...createFactories(connection),
    auditBuilder: (event) => event,
  });
  const result = await service.updateAppVersions({ versions, updatedBy: "admin", auditEvent: { actor: { username: "admin" } } });
  assert.equal(result.android.latestVersion, "1.5.0");
  assert.deepEqual(calls.filter((call) => typeof call === "string"), ["begin", "commit", "release"]);
  assert.equal(calls.some((call) => call.type === "execute" && /tbl_audit_backoffice/.test(call.sql)), true);
});

test("audit failure rolls back app version update", async () => {
  const calls = [];
  const connection = createConnection(calls, true);
  const service = createAppVersionService({
    transaction: createTransaction(connection, calls),
    ...createFactories(connection),
    auditBuilder: (event) => event,
  });
  await assert.rejects(
    service.updateAppVersions({ versions, updatedBy: "admin", auditEvent: { actor: { username: "admin" } } }),
    /audit failed/
  );
  assert.deepEqual(calls.filter((call) => typeof call === "string"), ["begin", "rollback", "release"]);
});
