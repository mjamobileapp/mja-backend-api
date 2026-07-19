const assert = require("node:assert/strict");
const test = require("node:test");
const { saveAksesRole } = require("../src/controller/akses");

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("access configuration rejects a non-array payload before opening a transaction", async () => {
  const res = createResponse();
  await saveAksesRole({ params: { idRole: "1" }, body: { id: 1 } }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { message: "Payload akses harus berupa array menu" });
});
