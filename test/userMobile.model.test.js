const assert = require("node:assert/strict");
const test = require("node:test");

const dbPool = require("../src/config/database");
const UserMobileModel = require("../src/models/userMobile");

test("updateDeviceId updates device data and lastLogin in one query", async () => {
  const originalExecute = dbPool.execute;
  const calls = [];
  dbPool.execute = async (query, values) => {
    calls.push({ query, values });
    return [{ affectedRows: 1 }];
  };

  try {
    await UserMobileModel.updateDeviceId(7, "device-1", "Android Phone", "1.2.3", "android");

    assert.equal(calls.length, 1);
    assert.match(calls[0].query, /SET deviceId = \?, deviceName = \?, appVersion = \?, osType = \?, lastLogin = UTC_TIMESTAMP\(\) WHERE id = \?/);
    assert.deepEqual(calls[0].values, ["device-1", "Android Phone", "1.2.3", "android", 7]);
  } finally {
    dbPool.execute = originalExecute;
  }
});

test("updatePasswordByUsername updates mobile password and lastChangePassword", async () => {
  const originalExecute = dbPool.execute;
  const calls = [];
  dbPool.execute = async (query, values) => {
    calls.push({ query, values });
    return [{ affectedRows: 1 }];
  };

  try {
    await UserMobileModel.updatePasswordByUsername("owner01", "hashed-password");

    assert.equal(calls.length, 1);
    assert.match(calls[0].query, /SET password = \?, lastChangePassword = UTC_TIMESTAMP\(\) WHERE username = \?/);
    assert.deepEqual(calls[0].values, ["hashed-password", "owner01"]);
  } finally {
    dbPool.execute = originalExecute;
  }
});
