const assert = require("node:assert/strict");
const test = require("node:test");
const HistoryController = require("../src/controller/history");
const HistoryModel = require("../src/models/history");
const { createHttpError } = require("../src/utils/httpError");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) { this.statusCode = statusCode; return this; },
  json(body) { this.body = body; return this; },
});

test("owner history preserves success response and forwards typed not-found errors", async () => {
  const original = HistoryModel.getHistoryTransaksi;
  HistoryModel.getHistoryTransaksi = async () => [{ tanggalTampilan: "2026-07-14" }];

  try {
    const response = createResponse();
    await HistoryController.getHistoryTransaksi({ query: { cabangId: "2" }, user: { idMitra: 1 } }, response);
    assert.deepEqual(response.body, { success: true, data: [{ tanggalTampilan: "2026-07-14" }] });

    const expectedError = createHttpError(404, "Data tidak ditemukan", "HISTORY_NOT_FOUND");
    HistoryModel.getHistoryTransaksi = async () => { throw expectedError; };
    await assert.rejects(
      HistoryController.getHistoryTransaksi({ query: { cabangId: "2" }, user: { idMitra: 1 } }, createResponse()),
      (error) => error === expectedError
    );
  } finally {
    HistoryModel.getHistoryTransaksi = original;
  }
});

test("history keeps request validation responses in the controller", async () => {
  const response = createResponse();
  await HistoryController.getHistoryMesin({ query: {}, user: { idMitra: 1 } }, response);
  assert.deepEqual(response.body, { error: "cabangId tidak ditemukan" });
  assert.equal(response.statusCode, 400);
});
