const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const test = require("node:test");
const MobileController = require("../src/controller/mobile");
const UsersModel = require("../src/models/users");
const UserMobileModel = require("../src/models/userMobile");
const EmailTokenModel = require("../src/models/emailToken");
const { createHttpError } = require("../src/utils/httpError");

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

const validRequest = () => ({
  body: { token: "activation-token", password: "secret123", confirmPassword: "secret123" },
});

test("account activation converts JWT failures to typed validation errors", async () => {
  const originalVerify = jwt.verify;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "activation-test-secret";
  jwt.verify = () => {
    const error = new Error("jwt expired");
    error.name = "TokenExpiredError";
    throw error;
  };

  try {
    await assert.rejects(
      MobileController.activateAccount(validRequest(), createResponse()),
      (error) => error.statusCode === 400 && error.code === "ACCOUNT_ACTIVATION_TOKEN_EXPIRED"
    );
  } finally {
    jwt.verify = originalVerify;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("account activation uses a typed error when the token user is missing", async () => {
  const originalVerify = jwt.verify;
  const originalGetUserByUsername = UsersModel.getUserByUsername;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "activation-test-secret";
  jwt.verify = () => ({ username: "missing-user", role: "backoffice", type: "activation" });
  UsersModel.getUserByUsername = async () => [[]];

  try {
    await assert.rejects(
      MobileController.activateAccount(validRequest(), createResponse()),
      (error) => error.statusCode === 400 && error.code === "ACCOUNT_ACTIVATION_TOKEN_INVALID"
    );
  } finally {
    jwt.verify = originalVerify;
    UsersModel.getUserByUsername = originalGetUserByUsername;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("account activation rejects a previously consumed one-time token", async () => {
  const originalVerify = jwt.verify;
  const originalConsume = EmailTokenModel.consumeOneTimeToken;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "activation-test-secret";
  jwt.verify = () => ({ username: "owner@example.test", role: "owner", type: "activation", jti: "used-jti" });
  EmailTokenModel.consumeOneTimeToken = async () => false;

  try {
    await assert.rejects(
      MobileController.activateAccount(validRequest(), createResponse()),
      (error) => error.statusCode === 400 && error.code === "ACCOUNT_ACTIVATION_TOKEN_USED"
    );
  } finally {
    jwt.verify = originalVerify;
    EmailTokenModel.consumeOneTimeToken = originalConsume;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("password reset rejects a previously consumed one-time token", async () => {
  const originalVerify = jwt.verify;
  const originalConsume = EmailTokenModel.consumeOneTimeToken;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "activation-test-secret";
  jwt.verify = () => ({ username: "owner@example.test", role: "owner", type: "reset_password", jti: "used-reset-jti" });
  EmailTokenModel.consumeOneTimeToken = async (payload) => {
    assert.equal(payload.tokenType, "reset_password");
    return false;
  };

  try {
    await assert.rejects(
      MobileController.activateAccount(validRequest(), createResponse()),
      (error) => error.statusCode === 400 && error.code === "ACCOUNT_RESET_TOKEN_USED"
    );
  } finally {
    jwt.verify = originalVerify;
    EmailTokenModel.consumeOneTimeToken = originalConsume;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

for (const role of ["owner", "kasir"]) {
  test(`account activation maps a missing ${role} user to an invalid-token error`, async () => {
    const originalVerify = jwt.verify;
    const originalGetUser = UserMobileModel.getUserByUsernameWithoutStatusFilter;
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "activation-test-secret";
    jwt.verify = () => ({ username: `missing-${role}`, role, type: "activation" });
    UserMobileModel.getUserByUsernameWithoutStatusFilter = async () => {
      throw createHttpError(404, "data not found", "MOBILE_USER_NOT_FOUND");
    };

    try {
      await assert.rejects(
        MobileController.activateAccount(validRequest(), createResponse()),
        (error) => error.statusCode === 400 && error.code === "ACCOUNT_ACTIVATION_TOKEN_INVALID"
      );
    } finally {
      jwt.verify = originalVerify;
      UserMobileModel.getUserByUsernameWithoutStatusFilter = originalGetUser;
      if (originalSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalSecret;
    }
  });
}
