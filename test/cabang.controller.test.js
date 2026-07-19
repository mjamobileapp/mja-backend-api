const assert = require("node:assert/strict");
const test = require("node:test");
const CabangController = require("../src/controller/cabang");
const CabangModel = require("../src/models/cabang");
const { createHttpError } = require("../src/utils/httpError");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("cabang controller preserves success response and forwards typed errors", async () => {
  const original = CabangModel.getCabangById;
  const data = { id: 3, kodeCabang: "CBG-1-0001", namaCabang: "Utama" };
  CabangModel.getCabangById = async () => data;

  try {
    const response = createResponse();
    await CabangController.getCabangById({ params: { id: "3" } }, response);
    assert.deepEqual(response.body, { message: "Get by Id Cabang success", data });
    assert.equal(response.statusCode, 200);

    const expectedError = createHttpError(404, "data not found", "CABANG_NOT_FOUND");
    CabangModel.getCabangById = async () => { throw expectedError; };
    await assert.rejects(
      CabangController.getCabangById({ params: { id: "999" } }, createResponse()),
      (error) => error === expectedError
    );
  } finally {
    CabangModel.getCabangById = original;
  }
});

test("cabang controller keeps required-field validation response", async () => {
  const response = createResponse();
  await CabangController.createNewCabang({ body: {}, user: { username: "admin" } }, response);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body.missingFields, ["idMitra", "namaCabang", "alamatCabang"]);
});
