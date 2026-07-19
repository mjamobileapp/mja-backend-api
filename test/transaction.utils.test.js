const assert = require("node:assert/strict");
const test = require("node:test");
const { createWithTransaction } = require("../src/utils/transaction");

const createConnection = (calls, overrides = {}) => ({
  async beginTransaction() {
    calls.push("beginTransaction");
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
  ...overrides,
});

test("withTransaction commits successful work and returns its result", async () => {
  const calls = [];
  const connection = createConnection(calls);
  const withTransaction = createWithTransaction({
    async getConnection() {
      calls.push("getConnection");
      return connection;
    },
  });

  const result = await withTransaction(async (receivedConnection) => {
    calls.push("work");
    assert.equal(receivedConnection, connection);
    return { id: 1 };
  });

  assert.deepEqual(result, { id: 1 });
  assert.deepEqual(calls, ["getConnection", "beginTransaction", "work", "commit", "release"]);
});

test("withTransaction rolls back and preserves callback failure", async () => {
  const calls = [];
  const expectedError = new Error("query failed");
  const withTransaction = createWithTransaction({
    async getConnection() {
      calls.push("getConnection");
      return createConnection(calls);
    },
  });

  await assert.rejects(
    withTransaction(async () => {
      calls.push("work");
      throw expectedError;
    }),
    (error) => error === expectedError
  );
  assert.deepEqual(calls, ["getConnection", "beginTransaction", "work", "rollback", "release"]);
});

test("withTransaction releases connection when begin transaction fails", async () => {
  const calls = [];
  const expectedError = new Error("begin failed");
  const withTransaction = createWithTransaction({
    async getConnection() {
      calls.push("getConnection");
      return createConnection(calls, {
        async beginTransaction() {
          calls.push("beginTransaction");
          throw expectedError;
        },
      });
    },
  });

  await assert.rejects(withTransaction(async () => {}), (error) => error === expectedError);
  assert.deepEqual(calls, ["getConnection", "beginTransaction", "release"]);
});

test("withTransaction rolls back when commit fails", async () => {
  const calls = [];
  const expectedError = new Error("commit failed");
  const withTransaction = createWithTransaction({
    async getConnection() {
      calls.push("getConnection");
      return createConnection(calls, {
        async commit() {
          calls.push("commit");
          throw expectedError;
        },
      });
    },
  });

  await assert.rejects(withTransaction(async () => calls.push("work")), (error) => error === expectedError);
  assert.deepEqual(calls, ["getConnection", "beginTransaction", "work", "commit", "rollback", "release"]);
});

test("withTransaction preserves the original error when rollback fails", async () => {
  const calls = [];
  const expectedError = new Error("callback failed");
  const rollbackError = new Error("rollback failed");
  const withTransaction = createWithTransaction({
    async getConnection() {
      calls.push("getConnection");
      return createConnection(calls, {
        async rollback() {
          calls.push("rollback");
          throw rollbackError;
        },
      });
    },
  });

  await assert.rejects(
    withTransaction(async () => {
      calls.push("work");
      throw expectedError;
    }),
    (error) => error === expectedError
  );
  assert.deepEqual(calls, ["getConnection", "beginTransaction", "work", "rollback", "release"]);
});

test("withTransaction forwards connection acquisition and invalid-work failures", async () => {
  const acquisitionError = new Error("connection unavailable");
  const withUnavailablePool = createWithTransaction({
    async getConnection() {
      throw acquisitionError;
    },
  });
  const withAvailablePool = createWithTransaction({
    async getConnection() {
      throw new Error("must not acquire connection for invalid work");
    },
  });

  await assert.rejects(withUnavailablePool(async () => {}), (error) => error === acquisitionError);
  await assert.rejects(withAvailablePool(null), /Transaction work must be a function/);
});
