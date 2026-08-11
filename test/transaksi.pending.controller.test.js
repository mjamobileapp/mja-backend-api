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

test("owner pending transactions validate the requested branch tenant scope", async () => {
  const original = {
    isActiveCabangForMitra: TransaksiModel.isActiveCabangForMitra,
    getPendingTransaksi: TransaksiModel.getPendingTransaksi,
  };
  let pendingCalled = false;

  TransaksiModel.isActiveCabangForMitra = async (idMitra, cabangId) => idMitra === 7 && Number(cabangId) === 9;
  TransaksiModel.getPendingTransaksi = async () => {
    pendingCalled = true;
    return [];
  };

  try {
    const ownBranchResponse = createResponse();
    await TransaksiController.getPendingTransaksi(
      { query: { cabangId: "9" }, user: { idMitra: 7, role: "owner" } },
      ownBranchResponse
    );
    assert.equal(ownBranchResponse.statusCode, 200);
    assert.equal(pendingCalled, true);

    pendingCalled = false;
    const foreignBranchResponse = createResponse();
    await TransaksiController.getPendingTransaksi(
      { query: { cabangId: "10" }, user: { idMitra: 7, role: "owner" } },
      foreignBranchResponse
    );
    assert.equal(foreignBranchResponse.statusCode, 403);
    assert.deepEqual(foreignBranchResponse.body, {
      error: "Cabang tidak sesuai dengan mitra atau tidak aktif",
      code: "BRANCH_SCOPE_FORBIDDEN",
    });
    assert.equal(pendingCalled, false);
  } finally {
    TransaksiModel.isActiveCabangForMitra = original.isActiveCabangForMitra;
    TransaksiModel.getPendingTransaksi = original.getPendingTransaksi;
  }
});

test("pending transaction response includes customer name", async () => {
  const original = TransaksiModel.getPendingTransaksi;

  TransaksiModel.getPendingTransaksi = async () => ([{
    idDetailPending: 15,
    invoiceNumber: "INV-9-20260811-0001",
    namaPelanggan: "Siti Aminah",
    layananPending: "cuci",
    waktuOrder: "2026-08-11T03:00:00.000Z",
    idMesinAsal: null,
  }]);

  try {
    const response = createResponse();
    await TransaksiController.getPendingTransaksi(
      { query: {}, user: { idMitra: 7, cabangId: 9, role: "kasir" } },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data[0].namaPelanggan, "Siti Aminah");
  } finally {
    TransaksiModel.getPendingTransaksi = original;
  }
});
