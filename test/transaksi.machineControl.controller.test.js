const assert = require("node:assert/strict");
const test = require("node:test");
const TransaksiController = require("../src/controller/transaksi");
const TransaksiModel = require("../src/models/transaksi");

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

test("machine-control controller derives owner scope from token and records the owner actor", async () => {
  const original = {
    isActiveCabangForMitra: TransaksiModel.isActiveCabangForMitra,
    startMesin: TransaksiModel.startMesin,
  };
  let receivedParams;

  TransaksiModel.isActiveCabangForMitra = async (idMitra, cabangId) => idMitra === 7 && cabangId === 9;
  TransaksiModel.startMesin = async (params) => {
    receivedParams = params;
  };

  try {
    const response = createResponse();
    await TransaksiController.startMesin(
      {
        body: { mesinId: 3, invoiceNumber: "INV-OWNER", cabangId: 9 },
        user: { id: 11, idMitra: 7, username: "owner-test" },
        machineControlActor: { type: "owner", id: 11, username: "owner-test" },
      },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(receivedParams, {
      idMitra: 7,
      cabangId: 9,
      kasirId: null,
      actor: { type: "owner", id: 11, username: "owner-test" },
      mesinId: 3,
      invoiceNumber: "INV-OWNER",
    });
  } finally {
    TransaksiModel.isActiveCabangForMitra = original.isActiveCabangForMitra;
    TransaksiModel.startMesin = original.startMesin;
  }
});

test("machine-control controller requires backoffice scope and rejects owner tenant spoofing", async () => {
  const original = {
    isActiveCabangForMitra: TransaksiModel.isActiveCabangForMitra,
    stopMesin: TransaksiModel.stopMesin,
  };
  let receivedParams;

  TransaksiModel.isActiveCabangForMitra = async (idMitra, cabangId) => idMitra === 7 && cabangId === 9;
  TransaksiModel.stopMesin = async (params) => {
    receivedParams = params;
  };

  try {
    const backofficeResponse = createResponse();
    await TransaksiController.stopMesin(
      {
        body: { mesinId: 3, idMitra: 7, cabangId: 9 },
        user: { id: 22, username: "backoffice-test" },
        machineControlActor: { type: "backoffice", id: 22, username: "backoffice-test" },
      },
      backofficeResponse
    );

    assert.equal(backofficeResponse.statusCode, 200);
    assert.deepEqual(receivedParams, {
      idMitra: 7,
      cabangId: 9,
      kasirId: null,
      actor: { type: "backoffice", id: 22, username: "backoffice-test" },
      mesinId: 3,
      invoiceNumber: null,
    });

    await assert.rejects(
      TransaksiController.startMesin({
        body: { mesinId: 3, invoiceNumber: "INV-SPOOF", idMitra: 8, cabangId: 9 },
        user: { id: 11, idMitra: 7, username: "owner-test" },
        machineControlActor: { type: "owner", id: 11, username: "owner-test" },
      }, createResponse()),
      (error) => error.statusCode === 403 && error.code === "BRANCH_SCOPE_FORBIDDEN"
    );
  } finally {
    TransaksiModel.isActiveCabangForMitra = original.isActiveCabangForMitra;
    TransaksiModel.stopMesin = original.stopMesin;
  }
});
