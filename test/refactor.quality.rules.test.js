const assert = require("node:assert/strict");
const test = require("node:test");
const {
  findDirectServerErrorResponses,
  findMagicStringViolations,
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

test("quality rule rejects hardcoded role, actor, and machine status decisions", () => {
  const violations = findMagicStringViolations(
    [
      'if (role === "owner") return true;',
      'const actor = { type: "kasir" };',
      "UPDATE tbl_mesin_detail SET status = 'READY' WHERE id = ?",
    ].join("\n"),
    "src/example.js"
  );

  assert.deepEqual(violations, [
    "src/example.js:1 contains a hardcoded role value; use the auth domain constants",
    "src/example.js:2 contains a hardcoded machine actor value; use the machine-control domain constants",
    "src/example.js:3 contains a hardcoded machine status value; use the mesin domain constants",
  ]);
});

test("quality rule permits constants, routes, messages, and comments", () => {
  assert.deepEqual(
    findMagicStringViolations(
      [
        'const MOBILE_ROLES = Object.freeze({ role: "owner" });',
        'app.use("/api/owner/kasir", router);',
        'return { message: "Mesin READY diterima" };',
        '// if (role === "owner") return true;',
      ].join("\n"),
      "src/domain/auth.js"
    ),
    []
  );

  assert.deepEqual(
    findMagicStringViolations(
      'const path = "/api/owner/kasir";\nconst message = "status READY";',
      "src/controller/example.js"
    ),
    []
  );
});
