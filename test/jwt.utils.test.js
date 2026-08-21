const assert = require("node:assert/strict");
const test = require("node:test");
const jwt = require("jsonwebtoken");

const { generateToken, TOKEN_TYPES } = require("../src/utils/jwt");

test("generateToken uses JWT_EXPIRES_IN from environment", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalExpiresIn = process.env.JWT_EXPIRES_IN;

  process.env.JWT_SECRET = "jwt-util-test-secret";
  process.env.JWT_EXPIRES_IN = "15m";

  try {
    const token = generateToken({ id: 1, username: "kasir", id_role: "kasir" }, TOKEN_TYPES.MOBILE);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    assert.equal(decoded.exp - decoded.iat, 15 * 60);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;

    if (originalExpiresIn === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = originalExpiresIn;
  }
});

test("generateToken defaults to eight hours when JWT_EXPIRES_IN is blank", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalExpiresIn = process.env.JWT_EXPIRES_IN;

  process.env.JWT_SECRET = "jwt-util-test-secret";
  process.env.JWT_EXPIRES_IN = " ";

  try {
    const token = generateToken({ id_user: 2, username: "admin", id_role: 1 }, TOKEN_TYPES.BACKOFFICE);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    assert.equal(decoded.exp - decoded.iat, 8 * 60 * 60);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;

    if (originalExpiresIn === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = originalExpiresIn;
  }
});
