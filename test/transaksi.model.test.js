const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");
const { createWithTransaction } = require("../src/utils/transaction");

const databasePath = require.resolve("../src/config/database");
const transaksiModelPath = require.resolve("../src/models/transaksi");
const transactionPath = require.resolve("../src/utils/transaction");

const loadTransaksiModel = (dbPool) => {
  const originalDatabaseModule = require.cache[databasePath];
  const originalTransaksiModel = require.cache[transaksiModelPath];
  const originalTransactionModule = require.cache[transactionPath];
  const databaseModule = new Module(databasePath);
  const transactionModule = new Module(transactionPath);

  databaseModule.filename = databasePath;
  databaseModule.loaded = true;
  databaseModule.exports = dbPool;
  require.cache[databasePath] = databaseModule;
  transactionModule.filename = transactionPath;
  transactionModule.loaded = true;
  transactionModule.exports = { withTransaction: createWithTransaction(dbPool) };
  require.cache[transactionPath] = transactionModule;
  delete require.cache[transaksiModelPath];

  const transaksiModel = require(transaksiModelPath);

  return {
    transaksiModel,
    restore() {
      delete require.cache[transaksiModelPath];

      if (originalDatabaseModule) {
        require.cache[databasePath] = originalDatabaseModule;
      } else {
        delete require.cache[databasePath];
      }

      if (originalTransactionModule) {
        require.cache[transactionPath] = originalTransactionModule;
      } else {
        delete require.cache[transactionPath];
      }

      if (originalTransaksiModel) {
        require.cache[transaksiModelPath] = originalTransaksiModel;
      }
    },
  };
};

test("createTransaksi rolls back and releases its connection when detail persistence fails", async () => {
  const calls = [];
  let executeCount = 0;
  const connection = {
    async beginTransaction() {
      calls.push("beginTransaction");
    },
    async execute() {
      executeCount += 1;

      if (executeCount === 1) return [[{ id: 1 }]];
      if (executeCount === 2) return [[{ id: 2 }]];
      if (executeCount === 3) return [[{ id: 3, namaLengkap: "Kasir Test" }]];
      if (executeCount === 4) return [[]];
      if (executeCount === 5) return [[{ harga: 20000 }]];
      if (executeCount === 6) return [{ insertId: 10 }];
      if (executeCount === 7) throw new Error("Detail order gagal dibuat");

      throw new Error("Unexpected query");
    },
    async commit() {
      calls.push("commit");
    },
    async rollback() {
      calls.push("rollback");
    },
    release() {
      calls.push("release");
    },
  };
  const { transaksiModel, restore } = loadTransaksiModel({
    async getConnection() {
      return connection;
    },
  });

  try {
    await assert.rejects(
      transaksiModel.createTransaksi({
        idMitra: 1,
        cabangId: 2,
        idUserMobile: 3,
        totalBayar: 20000,
        metodePembayaran: "CASH",
        items: [{ jenisLayanan: "cuci", jumlah: 1, subtotal: 20000 }],
      }),
      /Detail order gagal dibuat/
    );
    assert.deepEqual(calls, ["beginTransaction", "rollback", "release"]);
  } finally {
    restore();
  }
});
