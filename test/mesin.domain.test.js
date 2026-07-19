const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MACHINE_STATUSES,
  isMachineStatus,
  normalizeMachineStatus,
} = require("../src/domain/mesin");

test("machine status constants preserve the existing persisted values", () => {
  assert.deepEqual(MACHINE_STATUSES, {
    READY: "READY",
    IN_USE: "IN_USE",
    OFFLINE: "OFFLINE",
  });
  assert.equal(Object.isFrozen(MACHINE_STATUSES), true);
});

test("machine status normalization preserves the current comparison behavior", () => {
  assert.equal(normalizeMachineStatus(" ready "), MACHINE_STATUSES.READY);
  assert.equal(normalizeMachineStatus("in_use"), MACHINE_STATUSES.IN_USE);
  assert.equal(normalizeMachineStatus("offline"), MACHINE_STATUSES.OFFLINE);
  assert.equal(normalizeMachineStatus(null), "");
  assert.equal(normalizeMachineStatus(undefined), "");
});

test("machine status validation accepts only existing states", () => {
  assert.equal(isMachineStatus("READY"), true);
  assert.equal(isMachineStatus(" in_use "), true);
  assert.equal(isMachineStatus("offline"), true);
  assert.equal(isMachineStatus("MAINTENANCE"), false);
  assert.equal(isMachineStatus("UNKNOWN"), false);
  assert.equal(isMachineStatus(null), false);
});
