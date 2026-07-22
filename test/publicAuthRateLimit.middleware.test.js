const assert = require("node:assert/strict");
const test = require("node:test");
const { createPublicAuthRateLimiter, publicAppVersionRateLimiter } = require("../src/middleware/publicAuthRateLimit");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("public auth rate limiter blocks repeated attempts and expires the window", () => {
  let currentTime = 0;
  const limiter = createPublicAuthRateLimiter({
    keyPrefix: "test",
    maxAttempts: 2,
    windowMs: 1000,
    now: () => currentTime,
  });
  const req = { ip: "127.0.0.1" };
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  limiter(req, createResponse(), next);
  limiter(req, createResponse(), next);

  const limitedResponse = createResponse();
  limiter(req, limitedResponse, next);

  assert.equal(nextCalls, 2);
  assert.equal(limitedResponse.statusCode, 429);
  assert.deepEqual(limitedResponse.body, {
    code: "TOO_MANY_REQUESTS",
    message: "Terlalu banyak percobaan. Silakan coba kembali nanti.",
  });

  currentTime = 1000;
  limiter(req, createResponse(), next);
  assert.equal(nextCalls, 3);
});

test("public auth rate limiter tracks each client independently", () => {
  const limiter = createPublicAuthRateLimiter({ keyPrefix: "test", maxAttempts: 1, windowMs: 1000 });
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  limiter({ ip: "127.0.0.1" }, createResponse(), next);
  limiter({ ip: "127.0.0.2" }, createResponse(), next);

  assert.equal(nextCalls, 2);
});

test("app version exposes a dedicated public rate limiter", () => {
  assert.equal(typeof publicAppVersionRateLimiter, "function");
});
