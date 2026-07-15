const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const test = require("node:test");

const dbPool = require("../src/config/database");
const { authenticate, verifyBackofficeToken } = require("../src/middleware/auth");
const { authenticateMobileWithErrorResponse, verifyMobileToken } = require("../src/middleware/authMobile");
const { authenticateBackofficeOrOwner } = require("../src/middleware/authCombined");

const secret = "auth-middleware-test-secret";

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

test("backoffice authentication errors are typed", async () => {
  await assert.rejects(
    verifyBackofficeToken({ headers: {} }),
    (error) => error.statusCode === 401 && error.code === "UNAUTHORIZED"
  );

  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  try {
    await assert.rejects(
      verifyBackofficeToken({
        headers: { authorization: "Bearer invalid-token" },
      }),
      (error) => error.statusCode === 401 && error.code === "INVALID_TOKEN"
    );

    const token = jwt.sign(
      { id: 1, username: "missing-user", role: 1, tokenType: "backoffice" },
      secret
    );
    const originalExecute = dbPool.execute;
    dbPool.execute = async () => [[]];
    try {
      await assert.rejects(
        verifyBackofficeToken({ headers: { authorization: `Bearer ${token}` } }),
        (error) => error.statusCode === 403 && error.code === "ACCOUNT_NOT_FOUND"
      );
    } finally {
      dbPool.execute = originalExecute;
    }
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});

test("mobile authentication errors are typed", async () => {
  await assert.rejects(
    verifyMobileToken({ headers: {} }),
    (error) => error.statusCode === 401 && error.code === "UNAUTHORIZED"
  );

  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  try {
    const token = jwt.sign({ id: 1, tokenType: "mobile" }, secret);
    await assert.rejects(
      verifyMobileToken({ headers: { authorization: `Bearer ${token}` } }),
      (error) => error.statusCode === 401 && error.code === "INVALID_TOKEN"
    );

    const missingUserToken = jwt.sign({ id: 1, idMitra: 2, tokenType: "mobile" }, secret);
    const originalExecute = dbPool.execute;
    dbPool.execute = async () => [[]];
    try {
      await assert.rejects(
        verifyMobileToken({ headers: { authorization: `Bearer ${missingUserToken}` } }),
        (error) => error.statusCode === 403 && error.code === "ACCOUNT_NOT_FOUND"
      );
    } finally {
      dbPool.execute = originalExecute;
    }
  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
});

test("authentication middleware forwards unknown storage errors to the global handler", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalExecute = dbPool.execute;
  const storageError = new Error("database connection secret");
  process.env.JWT_SECRET = secret;
  dbPool.execute = async () => { throw storageError; };

  try {
    const backofficeToken = jwt.sign(
      { id: 1, username: "admin", role: 1, tokenType: "backoffice" },
      secret
    );
    const backofficeResponse = createResponse();
    let backofficeError;
    await authenticate(
      { headers: { authorization: `Bearer ${backofficeToken}` } },
      backofficeResponse,
      (error) => { backofficeError = error; }
    );
    assert.equal(backofficeError, storageError);
    assert.equal(backofficeResponse.statusCode, null);

    const mobileToken = jwt.sign({ id: 1, idMitra: 2, tokenType: "mobile" }, secret);
    const mobileResponse = createResponse();
    let mobileError;
    await authenticateMobileWithErrorResponse(
      { headers: { authorization: `Bearer ${mobileToken}` } },
      mobileResponse,
      (error) => { mobileError = error; }
    );
    assert.equal(mobileError, storageError);
    assert.equal(mobileResponse.statusCode, null);

    const combinedResponse = createResponse();
    let combinedError;
    await authenticateBackofficeOrOwner()(
      { headers: { authorization: `Bearer ${backofficeToken}` }, params: { idMitra: "2" } },
      combinedResponse,
      (error) => { combinedError = error; }
    );
    assert.equal(combinedError, storageError);
    assert.equal(combinedResponse.statusCode, null);
  } finally {
    dbPool.execute = originalExecute;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
