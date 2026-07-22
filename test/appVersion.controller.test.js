const assert = require("node:assert/strict");
const test = require("node:test");
const { createAppVersionController } = require("../src/controller/appVersion");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("app version controller returns the requested response contracts", async () => {
  const calls = [];
  const controller = createAppVersionController({
    model: {
      async getAllAppVersions() {
        return [{ platform: "android", latestVersion: "1.5.0", minRequiredVersion: "1.4.2", storeUrl: "https://store.test", releaseNotes: null }];
      },
    },
    service: {
      async updateAppVersions(payload) {
        calls.push(payload);
        return { android: { latestVersion: "1.5.0", minRequiredVersion: "1.4.2", storeUrl: "https://store.test", releaseNotes: null } };
      },
    },
  });

  const getResponse = createResponse();
  await controller.getAppVersions({}, getResponse);
  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.body.success, true);

  const putResponse = createResponse();
  await controller.updateAppVersions({
    user: { username: "authenticated-admin" },
    body: { versions: [{ platform: "android", latestVersion: "1.5.0", minRequiredVersion: "1.4.2", storeUrl: "https://store.test" }] },
    ip: "127.0.0.1",
  }, putResponse);
  assert.equal(putResponse.statusCode, 200);
  assert.equal(putResponse.body.message, "CREATE new APP Version success");
  assert.equal(calls[0].updatedBy, "authenticated-admin");
});

test("app version controller does not call service for missing required fields", async () => {
  let called = false;
  const controller = createAppVersionController({
    service: { async updateAppVersions() { called = true; } },
  });
  const response = createResponse();
  await controller.updateAppVersions({ body: { versions: [{ platform: "android" }] }, user: { username: "admin" } }, response);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body.missingFields, ["latestVersion", "minRequiredVersion", "storeUrl"]);
  assert.equal(called, false);
});
