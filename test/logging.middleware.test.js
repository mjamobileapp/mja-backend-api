const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.REQUEST_LOG = "false";

const middlewareLogRequest = require("../src/middleware/logs");

const request = (server, headers = {}) =>
  new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      { host: "127.0.0.1", port: address.port, path: "/health", headers },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ headers: res.headers, body: JSON.parse(body) }));
      }
    );
    req.on("error", reject);
    req.end();
  });

const startTestServer = () => {
  const server = http.createServer((req, res) => {
    middlewareLogRequest(req, res, () => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        hasRequestLogger: Boolean(req.log && typeof req.log.info === "function"),
        requestId: req.id,
        bindings: req.log.bindings(),
      }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
};

test("pino-http creates req.log and propagates one request ID", async () => {
  const server = await startTestServer();
  try {
    const response = await request(server);
    assert.equal(response.body.hasRequestLogger, true);
    assert.match(response.body.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(response.body.bindings.reqId, response.body.requestId);
    assert.equal(response.headers["x-request-id"], response.body.requestId);
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});

test("pino-http preserves a valid incoming request ID", async () => {
  const server = await startTestServer();
  try {
    const response = await request(server, { "x-request-id": "client-request-123" });
    assert.equal(response.body.requestId, "client-request-123");
    assert.equal(response.body.bindings.reqId, "client-request-123");
    assert.equal(response.headers["x-request-id"], "client-request-123");
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});

test("pino-http replaces an invalid incoming request ID", async () => {
  const server = await startTestServer();
  try {
    const response = await request(server, { "x-request-id": "invalid id with spaces" });
    assert.notEqual(response.body.requestId, "invalid id with spaces");
    assert.equal(response.body.bindings.reqId, response.body.requestId);
    assert.equal(response.headers["x-request-id"], response.body.requestId);
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});
