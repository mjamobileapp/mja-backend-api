const assert = require("node:assert/strict");
const test = require("node:test");

const { MACHINE_CONTROL_ACTOR_TYPES } = require("../src/domain/machineControl");

test("machine control actor constants preserve audit values", () => {
  assert.deepEqual(MACHINE_CONTROL_ACTOR_TYPES, {
    BACKOFFICE: "backoffice",
    OWNER: "owner",
    KASIR: "kasir",
  });
  assert.equal(Object.isFrozen(MACHINE_CONTROL_ACTOR_TYPES), true);
});
