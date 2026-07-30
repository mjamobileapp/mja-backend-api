const assert = require("node:assert/strict");
const test = require("node:test");
const CashflowModel = require("../src/models/cashflow");
const CashflowController = require("../src/controller/cashflow");

const createResponse = () => ({
  statusCode: 200,
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

test("cashier expense list forwards both branch and tenant scope to the model", async () => {
  const original = CashflowModel.getListPengeluaran;
  let receivedArgs;
  CashflowModel.getListPengeluaran = async (...args) => {
    receivedArgs = args;
    return [];
  };

  try {
    const res = createResponse();
    await CashflowController.getListPengeluaran(
      { query: { filter: "hari_ini" }, user: { idMitra: 7, cabangId: 3, role: "kasir" } },
      res
    );

    assert.deepEqual(receivedArgs, [3, 7, "hari_ini"]);
    assert.equal(res.statusCode, 200);
  } finally {
    CashflowModel.getListPengeluaran = original;
  }
});
