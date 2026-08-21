const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcrypt");

const dbPool = require("../src/config/database");
const UserOwnerModel = require("../src/models/userOwner");

test("changePassword updates owner password and lastChangePassword", async () => {
  const originalExecute = dbPool.execute;
  const originalCompare = bcrypt.compare;
  const originalHash = bcrypt.hash;
  const calls = [];

  dbPool.execute = async (query, values) => {
    calls.push({ query, values });
    if (query.startsWith("SELECT username, password")) {
      return [[{ username: "owner01", password: "old-hash" }]];
    }
    return [{ affectedRows: 1 }];
  };
  bcrypt.compare = async () => true;
  bcrypt.hash = async () => "new-hash";

  try {
    const username = await UserOwnerModel.changePassword(
      12,
      { oldPassword: "old-pass", newPassword: "new-pass" },
      "admin"
    );

    assert.equal(username, "owner01");
    assert.equal(calls.length, 2);
    assert.match(calls[1].query, /SET password = \?, updatedBy = \?, updatedDate = \?, lastChangePassword = UTC_TIMESTAMP\(\) WHERE id = \?/);
    assert.equal(calls[1].values[0], "new-hash");
    assert.equal(calls[1].values[1], "admin");
    assert.equal(calls[1].values[3], 12);
  } finally {
    dbPool.execute = originalExecute;
    bcrypt.compare = originalCompare;
    bcrypt.hash = originalHash;
  }
});
