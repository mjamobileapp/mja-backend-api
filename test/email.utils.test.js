const assert = require("node:assert/strict");
const test = require("node:test");
const { sendMailWithTimeout } = require("../src/utils/email");

test("sendMailWithTimeout returns the mail result before its deadline", async () => {
  const result = await sendMailWithTimeout({ sendMail: async () => ({ messageId: "test-id" }) }, {}, 20);

  assert.deepEqual(result, { messageId: "test-id" });
});

test("sendMailWithTimeout closes a stalled transporter and rejects with a timeout error", async () => {
  let closed = false;
  const transporter = {
    sendMail: () => new Promise(() => {}),
    close: () => {
      closed = true;
    },
  };

  await assert.rejects(
    sendMailWithTimeout(transporter, {}, 10),
    (error) => error.code === "EMAIL_SEND_TIMEOUT"
  );
  assert.equal(closed, true);
});
