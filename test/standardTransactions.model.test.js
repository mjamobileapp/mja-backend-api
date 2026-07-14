const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");
const { createWithTransaction } = require("../src/utils/transaction");

const transactionPath = require.resolve("../src/utils/transaction");

const loadModelWithTransaction = (modelRelativePath, connection) => {
  const modelPath = require.resolve(modelRelativePath);
  const originalModel = require.cache[modelPath];
  const originalTransaction = require.cache[transactionPath];
  const transactionModule = new Module(transactionPath);
  transactionModule.filename = transactionPath;
  transactionModule.loaded = true;
  transactionModule.exports = {
    withTransaction: createWithTransaction({ async getConnection() { return connection; } }),
  };
  require.cache[transactionPath] = transactionModule;
  delete require.cache[modelPath];

  return {
    model: require(modelPath),
    restore() {
      delete require.cache[modelPath];
      if (originalModel) require.cache[modelPath] = originalModel;
      if (originalTransaction) require.cache[transactionPath] = originalTransaction;
      else delete require.cache[transactionPath];
    },
  };
};

const createConnection = (calls, execute) => ({
  async beginTransaction() { calls.push("begin"); },
  async execute(sql, values) { calls.push("execute"); return execute(sql, values); },
  async commit() { calls.push("commit"); },
  async rollback() { calls.push("rollback"); },
  release() { calls.push("release"); },
});

test("createNewMitra commits generated code and rolls back failures through withTransaction", async () => {
  const successCalls = [];
  const success = loadModelWithTransaction("../src/models/mitra", createConnection(successCalls, async () => [[]]));
  try {
    const result = await success.model.createNewMitra({ namaMitra: "Mitra", alamatMitra: "Alamat", createdBy: "admin" });
    assert.equal(result.statusAktif, true);
    assert.deepEqual(successCalls.slice(-2), ["commit", "release"]);
  } finally { success.restore(); }

  const failureCalls = [];
  const failure = loadModelWithTransaction("../src/models/mitra", createConnection(failureCalls, async () => { throw new Error("insert failed"); }));
  try {
    await assert.rejects(failure.model.createNewMitra({ namaMitra: "Mitra", alamatMitra: "Alamat", createdBy: "admin" }), /insert failed/);
    assert.deepEqual(failureCalls.slice(-2), ["rollback", "release"]);
  } finally { failure.restore(); }
});

test("createNewCabang and resetCabang use one standard transaction lifecycle", async () => {
  const createCalls = [];
  let createExecuteCount = 0;
  const create = loadModelWithTransaction("../src/models/cabang", createConnection(createCalls, async () => {
    createExecuteCount += 1;
    if (createExecuteCount === 1) return [[{ id: 1, namaMitra: "Mitra" }]];
    return [[]];
  }));
  try {
    const result = await create.model.createNewCabang({ idMitra: 1, namaCabang: "Cabang", alamatCabang: "Alamat", createdBy: "admin" });
    assert.equal(result.namaMitra, "Mitra");
    assert.deepEqual(createCalls.slice(-2), ["commit", "release"]);
  } finally { create.restore(); }

  const resetCalls = [];
  const reset = loadModelWithTransaction("../src/models/cabang", createConnection(resetCalls, async () => [[{ id: 1 }]]));
  try {
    assert.equal(await reset.model.resetCabang(1), true);
    assert.deepEqual(resetCalls.slice(-2), ["commit", "release"]);
  } finally { reset.restore(); }
});

test("price and cashflow writes use a single standard transaction lifecycle", async () => {
  const hargaCalls = [];
  let hargaExecuteCount = 0;
  const harga = loadModelWithTransaction("../src/models/hargaCabang", createConnection(hargaCalls, async () => {
    hargaExecuteCount += 1;
    if (hargaExecuteCount <= 2) return [[{ id: hargaExecuteCount }]];
    if (hargaExecuteCount === 4) return [{ insertId: 9 }];
    return [[]];
  }));
  try {
    const result = await harga.model.createSettingHarga(1, 2, [{ jenisLayanan: "cuci", itemId: null, harga: 20000 }], "admin");
    assert.equal(result[0].id, 9);
    assert.deepEqual(hargaCalls.slice(-2), ["commit", "release"]);
  } finally { harga.restore(); }

  const cashflowCalls = [];
  let cashflowExecuteCount = 0;
  const cashflow = loadModelWithTransaction("../src/models/cashflow", createConnection(cashflowCalls, async () => {
    cashflowExecuteCount += 1;
    if (cashflowExecuteCount <= 3) return [[{ id: cashflowExecuteCount, namaLengkap: "Kasir" }]];
    if (cashflowExecuteCount === 4) return [[{ id: 4, tipeItem: "non_stok" }]];
    if (cashflowExecuteCount === 5) return [{ insertId: 10 }];
    return [[{ id: 10, idMitra: 1, cabangId: 2, idUserMobile: 3, itemId: 4, jumlahBarang: 0, nominal: 5000 }]];
  }));
  try {
    const result = await cashflow.model.createPengeluaran({ idMitra: 1, cabangId: 2, idUserMobile: 3, itemId: 4, jumlahBarang: 0, nominal: 5000 });
    assert.equal(result.id, 10);
    assert.deepEqual(cashflowCalls.slice(-2), ["commit", "release"]);
  } finally { cashflow.restore(); }
});

test("stock settings read their response before commit and roll back a failed read", async () => {
  const successCalls = [];
  let executeCount = 0;
  const success = loadModelWithTransaction("../src/models/settingStokMitra", createConnection(successCalls, async () => {
    executeCount += 1;
    if (executeCount <= 2) return [[{ id: executeCount }]];
    if (executeCount === 4) return [{ insertId: 12 }];
    return [[{ id: 12, idMitra: 1, itemId: 2 }]];
  }));
  try {
    const result = await success.model.createNewSetting({ idMitra: 1, itemId: 2, batasMinimum: 3, createdBy: "admin" });
    assert.equal(result.id, 12);
    assert.deepEqual(successCalls.slice(-2), ["commit", "release"]);
  } finally { success.restore(); }

  const failureCalls = [];
  let failureExecuteCount = 0;
  const failure = loadModelWithTransaction("../src/models/settingStokMitra", createConnection(failureCalls, async () => {
    failureExecuteCount += 1;
    if (failureExecuteCount <= 2) return [[{ id: failureExecuteCount }]];
    if (failureExecuteCount === 4) return [{ insertId: 12 }];
    throw new Error("response read failed");
  }));
  try {
    await assert.rejects(
      failure.model.createNewSetting({ idMitra: 1, itemId: 2, batasMinimum: 3, createdBy: "admin" }),
      /response read failed/
    );
    assert.deepEqual(failureCalls.slice(-2), ["rollback", "release"]);
  } finally { failure.restore(); }
});
