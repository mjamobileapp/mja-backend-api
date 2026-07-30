const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACCOUNT_TYPES,
  MOBILE_ROLES,
  isMobileRole,
  normalizeMobileRole,
} = require("../src/domain/auth");

test("auth domain constants preserve the existing account values", () => {
  assert.deepEqual(MOBILE_ROLES, { OWNER: "owner", KASIR: "kasir" });
  assert.deepEqual(ACCOUNT_TYPES, {
    BACKOFFICE: "backoffice",
    OWNER: "owner",
    KASIR: "kasir",
  });
  assert.equal(Object.isFrozen(MOBILE_ROLES), true);
  assert.equal(Object.isFrozen(ACCOUNT_TYPES), true);
});

test("mobile role normalization preserves the current comparison behavior", () => {
  assert.equal(normalizeMobileRole(" Owner "), MOBILE_ROLES.OWNER);
  assert.equal(normalizeMobileRole("KASIR"), MOBILE_ROLES.KASIR);
  assert.equal(normalizeMobileRole(null), "");
  assert.equal(normalizeMobileRole(undefined), "");
  assert.equal(normalizeMobileRole("   "), "");
});

test("mobile role validation accepts only owner and kasir", () => {
  assert.equal(isMobileRole("owner"), true);
  assert.equal(isMobileRole(" KASIR "), true);
  assert.equal(isMobileRole("backoffice"), false);
  assert.equal(isMobileRole("admin"), false);
  assert.equal(isMobileRole(null), false);
});
