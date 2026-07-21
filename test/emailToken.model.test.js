const assert = require("node:assert/strict");
const test = require("node:test");
const { createEmailTokenModel } = require("../src/models/emailToken");

test("email token model registers a token with its expiry", async () => {
  const calls = [];
  const model = createEmailTokenModel({ execute: async (query, values) => {
    calls.push({ query, values });
    return [{ insertId: 10 }, {}];
  } });
  const expiresAt = new Date("2026-07-21T12:00:00.000Z");
  assert.equal(await model.registerOneTimeToken({ jti: "jti-1", username: "user", tokenType: "activation", expiresAt }), 10);
  assert.match(calls[0].query, /INSERT INTO tbl_email_one_time_token/);
  assert.deepEqual(calls[0].values, ["jti-1", "user", "activation", expiresAt]);
});

test("email token model reports whether an activation token was consumed", async () => {
  const model = createEmailTokenModel({ execute: async () => [{ affectedRows: 1 }, {}] });
  assert.equal(await model.consumeOneTimeToken({ jti: "jti-1", username: "user", tokenType: "activation" }), true);
  const expiredOrUsedModel = createEmailTokenModel({ execute: async () => [{ affectedRows: 0 }, {}] });
  assert.equal(await expiredOrUsedModel.consumeOneTimeToken({ jti: "jti-1", username: "user", tokenType: "activation" }), false);
});
