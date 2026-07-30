const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");
const { createWithTransaction } = require("../src/utils/transaction");

const aksesModelPath = require.resolve("../src/models/akses");
const transactionPath = require.resolve("../src/utils/transaction");

const loadAksesModel = (connection) => {
  const originalModel = require.cache[aksesModelPath];
  const originalTransaction = require.cache[transactionPath];
  const transactionModule = new Module(transactionPath);
  transactionModule.filename = transactionPath;
  transactionModule.loaded = true;
  transactionModule.exports = { withTransaction: createWithTransaction({ async getConnection() { return connection; } }) };
  require.cache[transactionPath] = transactionModule;
  delete require.cache[aksesModelPath];

  return {
    model: require(aksesModelPath),
    restore() {
      delete require.cache[aksesModelPath];
      if (originalModel) require.cache[aksesModelPath] = originalModel;
      if (originalTransaction) require.cache[transactionPath] = originalTransaction;
      else delete require.cache[transactionPath];
    },
  };
};

test("saveAksesRole atomically replaces parent and child access rows", async () => {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push("begin"); },
    async execute() { calls.push("execute"); },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); },
  };
  const { model, restore } = loadAksesModel(connection);

  try {
    await model.saveAksesRole(1, [{ id: 10, checked: true, children: [{ id: 11, checked: false }] }]);
    assert.deepEqual(calls, ["begin", "execute", "execute", "execute", "commit", "release"]);
  } finally { restore(); }
});

test("saveAksesRole rolls back the delete when an access insert fails", async () => {
  const calls = [];
  let executeCount = 0;
  const connection = {
    async beginTransaction() { calls.push("begin"); },
    async execute() {
      calls.push("execute");
      executeCount += 1;
      if (executeCount === 2) throw new Error("insert failed");
    },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); },
  };
  const { model, restore } = loadAksesModel(connection);

  try {
    await assert.rejects(model.saveAksesRole(1, [{ id: 10, checked: true }]), /insert failed/);
    assert.deepEqual(calls, ["begin", "execute", "execute", "rollback", "release"]);
  } finally { restore(); }
});
