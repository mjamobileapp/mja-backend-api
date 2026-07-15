const assert = require("node:assert/strict");
const test = require("node:test");
const HargaCabangController = require("../src/controller/hargaCabang");
const HargaCabangModel = require("../src/models/hargaCabang");
const { createHttpError } = require("../src/utils/httpError");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) { this.statusCode = statusCode; return this; },
  json(body) { this.body = body; return this; },
});

test("branch price controller preserves success response and forwards typed errors", async () => {
  const original = HargaCabangModel.getSettingHarga;
  HargaCabangModel.getSettingHarga = async () => [{ jenisLayanan: "cuci", harga: 20000 }];

  try {
    const response = createResponse();
    await HargaCabangController.getSettingHarga({ query: { cabangId: "2" }, user: { idMitra: 1 } }, response);
    assert.deepEqual(response.body, {
      message: "Get Data Setting Harga Layanan successful",
      data: [{ jenisLayanan: "cuci", harga: 20000 }],
    });

    const expectedError = createHttpError(404, "Cabang tidak ditemukan", "CABANG_NOT_FOUND");
    HargaCabangModel.getSettingHarga = async () => { throw expectedError; };
    await assert.rejects(
      HargaCabangController.getSettingHarga({ query: { cabangId: "2" }, user: { idMitra: 1 } }, createResponse()),
      (error) => error === expectedError
    );
  } finally {
    HargaCabangModel.getSettingHarga = original;
  }
});

test("branch price controller keeps request validation response", async () => {
  const response = createResponse();
  await HargaCabangController.getSettingHarga({ query: {}, user: { idMitra: 1 } }, response);
  assert.deepEqual(response.body, { message: "cabangId tidak ditemukan di query params" });
  assert.equal(response.statusCode, 400);
});

test("branch price controller rejects empty, zero, and negative prices", async () => {
  const original = HargaCabangModel.createSettingHarga;
  let modelCalled = false;
  HargaCabangModel.createSettingHarga = async () => {
    modelCalled = true;
  };

  try {
    for (const harga of ["", 0, -1, true]) {
      const response = createResponse();
      await HargaCabangController.createSettingHarga(
        {
          body: { cabangId: 2, item: [{ jenisLayanan: "cuci", itemId: null, harga }] },
          user: { idMitra: 1, username: "owner" },
        },
        response
      );

      assert.equal(response.statusCode, 400);
      assert.match(response.body.message, /harga/i);
    }

    assert.equal(modelCalled, false);
  } finally {
    HargaCabangModel.createSettingHarga = original;
  }
});

test("branch price controller rejects duplicate logical price keys", async () => {
  const original = HargaCabangModel.createSettingHarga;
  let modelCalled = false;
  HargaCabangModel.createSettingHarga = async () => {
    modelCalled = true;
  };

  try {
    const response = createResponse();
    await HargaCabangController.createSettingHarga(
      {
        body: {
          cabangId: 2,
          item: [
            { jenisLayanan: "cuci", itemId: null, harga: 20000 },
            { jenisLayanan: "cuci", itemId: null, harga: 25000 },
          ],
        },
        user: { idMitra: 1, username: "owner" },
      },
      response
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /duplikat/i);
    assert.equal(modelCalled, false);
  } finally {
    HargaCabangModel.createSettingHarga = original;
  }
});
