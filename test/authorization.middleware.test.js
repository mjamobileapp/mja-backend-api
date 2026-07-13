const assert = require("node:assert/strict");
const test = require("node:test");
const { requireMobileOwner, requireMobileKasir } = require("../src/middleware/authorization");

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

test("owner authorization rejects kasir and permits owner", () => {
  const kasirResponse = createResponse();
  let nextCalled = false;
  requireMobileOwner({ user: { role: "kasir" } }, kasirResponse, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(kasirResponse.statusCode, 403);
  assert.equal(kasirResponse.body.code, "FORBIDDEN");

  const ownerResponse = createResponse();
  requireMobileOwner({ user: { role: "owner" } }, ownerResponse, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(ownerResponse.statusCode, null);
});

test("cashier authorization rejects owner and permits kasir", () => {
  const ownerResponse = createResponse();
  let ownerNextCalled = false;
  requireMobileKasir({ user: { role: "owner" } }, ownerResponse, () => {
    ownerNextCalled = true;
  });

  assert.equal(ownerResponse.statusCode, 403);
  assert.equal(ownerResponse.body.code, "FORBIDDEN");
  assert.equal(ownerNextCalled, false);

  const kasirResponse = createResponse();
  let kasirNextCalled = false;
  requireMobileKasir({ user: { role: "kasir" } }, kasirResponse, () => {
    kasirNextCalled = true;
  });

  assert.equal(kasirNextCalled, true);
  assert.equal(kasirResponse.statusCode, null);
});
