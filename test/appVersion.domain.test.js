const assert = require("node:assert/strict");
const test = require("node:test");
const {
  mapAppVersionRows,
  normalizeAppVersionPayload,
} = require("../src/domain/appVersion");

const valid = {
  versions: [{
    platform: "android",
    latestVersion: " 1.5.0 ",
    minRequiredVersion: "1.4.2",
    storeUrl: "https://play.google.com/store/apps/details?id=com.smartlaundry",
    releaseNotes: " Catatan ",
  }],
};

test("app version payload is normalized and public rows hide internal columns", () => {
  const payload = normalizeAppVersionPayload(valid);
  assert.deepEqual(payload.versions[0], {
    platform: "android",
    latestVersion: "1.5.0",
    minRequiredVersion: "1.4.2",
    storeUrl: "https://play.google.com/store/apps/details?id=com.smartlaundry",
    releaseNotes: "Catatan",
  });

  assert.deepEqual(mapAppVersionRows([{
    platform: "android",
    latestVersion: "1.5.0",
    minRequiredVersion: "1.4.2",
    storeUrl: "https://example.test",
    releaseNotes: null,
    updatedBy: "admin",
    updatedDate: "secret",
  }]), {
    android: {
      latestVersion: "1.5.0",
      minRequiredVersion: "1.4.2",
      storeUrl: "https://example.test",
      releaseNotes: null,
    },
  });
});

test("app version validation reports missing fields and rejects invalid values", () => {
  assert.deepEqual(normalizeAppVersionPayload({ versions: [{ platform: "android" }] }), {
    missingFields: ["latestVersion", "minRequiredVersion", "storeUrl"],
  });
  assert.deepEqual(normalizeAppVersionPayload({}), { missingFields: ["versions"] });
  assert.throws(
    () => normalizeAppVersionPayload({ versions: [valid.versions[0], valid.versions[0]] }),
    (error) => error.code === "APP_VERSION_VALIDATION_ERROR"
  );
  assert.throws(
    () => normalizeAppVersionPayload({ versions: [{ ...valid.versions[0], storeUrl: "ftp://example.test" }] }),
    (error) => error.code === "APP_VERSION_VALIDATION_ERROR"
  );
});
