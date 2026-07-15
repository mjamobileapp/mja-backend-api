const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const test = require("node:test");

const dbPool = require("../src/config/database");
const { verifyBackofficeToken } = require("../src/middleware/auth");
const { verifyMobileToken } = require("../src/middleware/authMobile");

const secret = "auth-middleware-test-secret";

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
