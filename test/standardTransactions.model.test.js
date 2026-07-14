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
