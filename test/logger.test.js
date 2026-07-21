const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";

test("global logger defaults to info level", () => {
  delete process.env.LOG_LEVEL;
  delete require.cache[require.resolve("../src/utils/logger")];
  const logger = require("../src/utils/logger");

  assert.equal(logger.level, "info");
  assert.equal(typeof logger.info, "function");
  assert.equal(typeof logger.error, "function");
});

test("global logger honors LOG_LEVEL", () => {
  process.env.LOG_LEVEL = "debug";
  delete require.cache[require.resolve("../src/utils/logger")];
  const logger = require("../src/utils/logger");

  assert.equal(logger.level, "debug");
  delete process.env.LOG_LEVEL;
});
