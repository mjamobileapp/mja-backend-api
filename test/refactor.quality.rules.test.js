const assert = require("node:assert/strict");
const test = require("node:test");
const {
  findDirectServerErrorResponses,
  findRethrowOnlyCatches,
} = require("../scripts/refactor-quality-rules");

test("quality rule rejects direct 5xx controller responses", () => {
  const violations = findDirectServerErrorResponses(
    "const handler = (req, res) => res.status(500).json({ error: 'internal' });",
    "src/controller/example.js"
  );

  assert.deepEqual(violations, [
    "src/controller/example.js:1 controller sends a direct 5xx response",
  ]);
});

test("quality rule permits client-error responses for controller validation", () => {
  assert.deepEqual(
    findDirectServerErrorResponses(
      "return res.status(400).json({ error: 'invalid input' });",
      "src/controller/example.js"
    ),
    []
  );
});

test("quality rule rejects exact rethrow-only catches", () => {
  assert.deepEqual(
    findRethrowOnlyCatches(
      "async function read() { try { await work(); } catch (error) { throw error; } }",
      "src/models/example.js"
    ),
    ["src/models/example.js:1 contains a rethrow-only catch"]
  );
});

test("quality rule permits catches that perform recovery before rethrowing", () => {
  assert.deepEqual(
    findRethrowOnlyCatches(
      "try { await work(); } catch (error) { await rollback(); throw error; }",
      "src/models/example.js"
    ),
    []
  );
});
