const assert = require("node:assert/strict");
const test = require("node:test");
const DashboardController = require("../src/controller/dashboard");
const DashboardModel = require("../src/models/dashboard");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) { this.statusCode = statusCode; return this; },
  json(body) { this.body = body; return this; },
});

test("dashboard controllers preserve successful response contracts and propagate failures", async () => {
  const originalGetMitra = DashboardModel.getMitra;
  DashboardModel.getMitra = async () => [{ id: 1 }];

  try {
    const successResponse = createResponse();
    await DashboardController.getMitra({}, successResponse);
    assert.deepEqual(successResponse.body, { success: true, total: 1, data: [{ id: 1 }] });

    const expectedError = new Error("database unavailable");
    DashboardModel.getMitra = async () => { throw expectedError; };
    await assert.rejects(DashboardController.getMitra({}, createResponse()), (error) => error === expectedError);
  } finally {
    DashboardModel.getMitra = originalGetMitra;
  }
});
