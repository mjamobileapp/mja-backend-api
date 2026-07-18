const assert = require("node:assert/strict");
const test = require("node:test");
const {
  requireMobileOwner,
  requireMobileKasir,
  requireMobileOwnerOrKasirCabang,
} = require("../src/middleware/authorization");

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

test("owner or cashier branch authorization scopes cashier to own cabang", () => {
  const authorize = requireMobileOwnerOrKasirCabang();

  const ownerResponse = createResponse();
  let ownerNextCalled = false;
  authorize(
    { user: { role: "owner", cabangId: null }, query: { cabangId: "20" } },
    ownerResponse,
    () => {
      ownerNextCalled = true;
    }
  );
  assert.equal(ownerNextCalled, true);

  const ownCabangResponse = createResponse();
  let ownCabangNextCalled = false;
  authorize(
    { user: { role: "kasir", cabangId: 10 }, query: { cabangId: "10" } },
    ownCabangResponse,
    () => {
      ownCabangNextCalled = true;
    }
  );
  assert.equal(ownCabangNextCalled, true);

  const otherCabangResponse = createResponse();
  let otherCabangNextCalled = false;
  authorize(
    { user: { role: "kasir", cabangId: 10 }, query: { cabangId: "20" } },
    otherCabangResponse,
    () => {
      otherCabangNextCalled = true;
    }
  );
  assert.equal(otherCabangNextCalled, false);
  assert.equal(otherCabangResponse.statusCode, 403);
  assert.equal(otherCabangResponse.body.message, "Kasir hanya dapat mengakses data cabang sendiri");
});

test("owner or cashier branch authorization can use cashier token cabang when query is omitted", () => {
  const authorize = requireMobileOwnerOrKasirCabang({ allowKasirTokenCabang: true });
  const response = createResponse();
  let nextCalled = false;

  authorize(
    { user: { role: "kasir", cabangId: 10 }, query: {} },
    response,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});
