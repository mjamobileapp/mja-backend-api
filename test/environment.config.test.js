const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getEmailSendTimeoutMs,
  getPublicAuthRateLimitConfig,
  getRequiredJwtSecret,
  getTrustProxy,
} = require("../src/config/environment");

test("getRequiredJwtSecret rejects an absent or blank JWT secret", () => {
  assert.throws(() => getRequiredJwtSecret({}), /JWT_SECRET/);
  assert.throws(() => getRequiredJwtSecret({ JWT_SECRET: "   " }), /JWT_SECRET/);
});

test("getRequiredJwtSecret returns the configured JWT secret", () => {
  assert.equal(getRequiredJwtSecret({ JWT_SECRET: "secure-test-secret" }), "secure-test-secret");
});

test("getTrustProxy is disabled by default and only enabled explicitly", () => {
  assert.equal(getTrustProxy({}), false);
  assert.equal(getTrustProxy({ TRUST_PROXY: "true" }), true);
  assert.equal(getTrustProxy({ TRUST_PROXY: "1" }), true);
  assert.equal(getTrustProxy({ TRUST_PROXY: "false" }), false);
});

test("getPublicAuthRateLimitConfig validates configured values and uses safe defaults", () => {
  assert.deepEqual(getPublicAuthRateLimitConfig({}), {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
  });
  assert.deepEqual(
    getPublicAuthRateLimitConfig({
      PUBLIC_AUTH_RATE_LIMIT_WINDOW_MS: "60000",
      PUBLIC_AUTH_RATE_LIMIT_MAX: "3",
    }),
    { windowMs: 60000, maxAttempts: 3 }
  );
  assert.deepEqual(
    getPublicAuthRateLimitConfig({
      PUBLIC_AUTH_RATE_LIMIT_WINDOW_MS: "0",
      PUBLIC_AUTH_RATE_LIMIT_MAX: "invalid",
    }),
    { windowMs: 15 * 60 * 1000, maxAttempts: 5 }
  );
});

test("getEmailSendTimeoutMs validates configured values and uses a safe default", () => {
  assert.equal(getEmailSendTimeoutMs({}), 15 * 1000);
  assert.equal(getEmailSendTimeoutMs({ EMAIL_SEND_TIMEOUT_MS: "2500" }), 2500);
  assert.equal(getEmailSendTimeoutMs({ EMAIL_SEND_TIMEOUT_MS: "0" }), 15 * 1000);
});
