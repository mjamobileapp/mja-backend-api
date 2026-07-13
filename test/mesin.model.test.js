const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

const databasePath = require.resolve("../src/config/database");
const mesinModelPath = require.resolve("../src/models/mesin");

const loadMesinModel = (dbPool) => {
  const originalDatabaseModule = require.cache[databasePath];
  const originalMesinModel = require.cache[mesinModelPath];
  const databaseModule = new Module(databasePath);

  databaseModule.filename = databasePath;
  databaseModule.loaded = true;
  databaseModule.exports = dbPool;
  require.cache[databasePath] = databaseModule;
  delete require.cache[mesinModelPath];

  const mesinModel = require(mesinModelPath);

  return {
    mesinModel,
    restore() {
      delete require.cache[mesinModelPath];

      if (originalDatabaseModule) {
        require.cache[databasePath] = originalDatabaseModule;
      } else {
        delete require.cache[databasePath];
      }

      if (originalMesinModel) {
        require.cache[mesinModelPath] = originalMesinModel;
      }
    },
  };
};

test("createNewMesin commits master and detail inserts in one transaction", async () => {
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
      if (executeCount === 3) return [[]];
      if (executeCount === 4) return [{ insertId: 10 }];
      if (executeCount === 5) return [{ insertId: 11 }];

      throw new Error("Unexpected query");
    },
    async query() {
      return [[{ totalGrupMesin: 0 }]];
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
  const { mesinModel, restore } = loadMesinModel({
    async getConnection() {
      return connection;
    },
  });

  try {
    const result = await mesinModel.createNewMesin(
      { idMitra: 1, cabangId: 2, espId: "ESP-01", washer: 1, dryer: 0 },
      "admin"
    );

    assert.deepEqual(result, {
      idMitra: 1,
      cabangId: 2,
      espId: "ESP-01",
      namaGroupMesinOtomatis: "Mesin Laundry 1",
      washer: { id: 11, status: "Ready" },
      dryer: null,
    });
    assert.deepEqual(calls, ["beginTransaction", "commit", "release"]);
  } finally {
    restore();
  }
});

test("createNewMesin rolls back and releases the connection when a detail insert fails", async () => {
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
      if (executeCount === 3) return [[]];
      if (executeCount === 4) return [{ insertId: 10 }];
      if (executeCount === 5) throw new Error("Detail mesin gagal dibuat");

      throw new Error("Unexpected query");
    },
    async query() {
      return [[{ totalGrupMesin: 0 }]];
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
  const { mesinModel, restore } = loadMesinModel({
    async getConnection() {
      return connection;
    },
  });

  try {
    await assert.rejects(
      mesinModel.createNewMesin({ idMitra: 1, cabangId: 2, espId: "ESP-01", washer: 1, dryer: 0 }, "admin"),
      /Detail mesin gagal dibuat/
    );
    assert.deepEqual(calls, ["beginTransaction", "rollback", "release"]);
  } finally {
    restore();
  }
});
