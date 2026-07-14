const assert = require("node:assert/strict");
const test = require("node:test");
const { catchAsync } = require("../src/utils/catchAsync");
const { errorHandler } = require("../src/middleware/errorHandler");
const { createHttpError } = require("../src/utils/httpError");

const createResponse = () => ({
  headersSent: false,
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

test("catchAsync forwards the original rejected error", async () => {
  const expectedError = new Error("expected failure");
  let receivedError;
  const handler = catchAsync(async () => {
    throw expectedError;
  });

  await handler({}, {}, (error) => {
    receivedError = error;
  });

  assert.equal(receivedError, expectedError);
});

test("catchAsync completes successful handlers without calling next", async () => {
  let nextCalled = false;
  const handler = catchAsync(async (_req, res) => {
    res.completed = true;
  });
  const res = {};

  await handler({}, res, () => {
    nextCalled = true;
  });

  assert.equal(res.completed, true);
  assert.equal(nextCalled, false);
});

test("global error handler preserves typed client errors and sanitizes server errors", () => {
  const typedResponse = createResponse();
  errorHandler(createHttpError(404, "data not found", "MASTER_ITEM_NOT_FOUND"), { method: "GET", originalUrl: "/item/404" }, typedResponse, () => {});
  assert.equal(typedResponse.statusCode, 404);
  assert.deepEqual(typedResponse.body, {
    success: false,
    code: "MASTER_ITEM_NOT_FOUND",
    message: "data not found",
  });

  const serverResponse = createResponse();
  errorHandler(new Error("database secret"), { method: "GET", originalUrl: "/item" }, serverResponse, () => {});
  assert.equal(serverResponse.statusCode, 500);
  assert.deepEqual(serverResponse.body, {
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal Server Error",
  });
});

test("global error handler delegates when headers were sent", () => {
  const res = createResponse();
  res.headersSent = true;
  const error = new Error("late failure");
  let forwardedError;

  errorHandler(error, { method: "GET", originalUrl: "/item" }, res, (receivedError) => {
    forwardedError = receivedError;
  });

  assert.equal(forwardedError, error);
  assert.equal(res.statusCode, null);
});
