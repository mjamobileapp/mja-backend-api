const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createApp } = require("../src/app");
const { getMissingServerEnv } = require("../src/config/environment");
const { sanitizeServerErrorPayload, sanitizeServerErrorResponse } = require("../src/middleware/responseSanitizer");

const request = (server, path, { method = "GET", headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path,
        method,
        headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      }
    );

    req.on("error", reject);
    req.end();
  });

const withServer = async (callback, environment) => {
  const server = await new Promise((resolve) => {
    const instance = createApp({ environment }).listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    return await callback(server);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
};

test("health endpoint remains available without authentication", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/");

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, "API Monitoring working!");
  });
});

test("mobile route without token returns the authentication status instead of 500", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/mobile/notifications");

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      code: "UNAUTHORIZED",
      message: "Akses ditolak, token tidak ditemukan",
    });
  });
});

test("unknown route returns a consistent 404 response", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/api/does-not-exist");

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      code: "ROUTE_NOT_FOUND",
      message: "Route tidak ditemukan",
    });
  });
});

test("disallowed CORS origin is rejected with 403", async () => {
  await withServer(async (server) => {
    const response = await request(server, "/", { headers: { Origin: "https://untrusted.example" } });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      code: "CORS_FORBIDDEN",
      message: "Origin tidak diizinkan oleh CORS",
    });
  });
});

test("sanitizer removes implementation details from server-error payloads", () => {
  assert.deepEqual(
    sanitizeServerErrorPayload({
      message: "ER_PARSE_ERROR: SQL detail",
      serverMessage: "SQL detail",
      details: "stack",
      error: "SQL detail",
    }),
    { message: "Internal Server Error" }
  );
});

test("sanitizer preserves client-error payloads", () => {
  let responsePayload;
  const response = {
    statusCode: 400,
    json(payload) {
      responsePayload = payload;
      return payload;
    },
  };

  sanitizeServerErrorResponse({}, response, () => {});
  response.json({ message: "Bad request", error: "Field wajib diisi" });

  assert.deepEqual(responsePayload, { message: "Bad request", error: "Field wajib diisi" });
});

test("server environment validator identifies only missing required values", () => {
  assert.deepEqual(getMissingServerEnv({ JWT_SECRET: "secret", DB_HOST: "host", DB_USERNAME: "user", DB_NAME: "db" }), []);
  assert.deepEqual(getMissingServerEnv({ JWT_SECRET: "secret", DB_HOST: "", DB_USERNAME: "user" }), ["DB_HOST", "DB_NAME"]);
});

test("protected user and mobile routes reject requests without a token before accessing database", async () => {
  const protectedRoutes = [
    { method: "POST", path: "/api/backoffice/users" },
    { method: "POST", path: "/api/backoffice/userowner" },
    { method: "POST", path: "/api/owner/kasir" },
    { method: "POST", path: "/api/mobile/logout" },
    { method: "GET", path: "/api/owner/stokmitra" },
  ];

  await withServer(async (server) => {
    for (const route of protectedRoutes) {
      const response = await request(server, route.path, { method: route.method });
      assert.equal(response.statusCode, 401, `${route.method} ${route.path}`);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        code: "UNAUTHORIZED",
        message: "Akses ditolak, token tidak ditemukan",
      });
    }
  });
});
