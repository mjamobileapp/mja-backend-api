require("dotenv").config();

const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const test = require("node:test");

process.env.DB_NAME = `${process.env.DB_NAME}_refactor_test`;

const db = require("../src/config/database");
const { createApp } = require("../src/app");

const request = (server, path, token) =>
  new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path,
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ statusCode: res.statusCode, body }));
      }
    );
    req.on("error", reject);
    req.end();
  });

let server;
let fixture;

test.before(async () => {
  const suffix = Date.now();
  const [mitraResult] = await db.execute(
    "INSERT INTO tbl_mitra (kodeMitra, namaMitra, alamatMitra, createdBy, statusAktif) VALUES (?, ?, ?, ?, 1)",
    [`TEST-${suffix}`, `Mitra Test ${suffix}`, "Test", "integration-test"]
  );
  const [cabangResult] = await db.execute(
    "INSERT INTO tbl_cabang (idMitra, kodeCabang, namaCabang, alamatCabang, createdBy, statusAktif) VALUES (?, ?, ?, ?, ?, 1)",
    [mitraResult.insertId, `CAB-${suffix}`, `Cabang Test ${suffix}`, "Test", "integration-test"]
  );
  const [ownerResult] = await db.execute(
    "INSERT INTO tbl_users_mobile (username, password, role, idMitra, cabangId, namaLengkap, noTelp, email, createdBy, statusAktif) VALUES (?, ?, 'owner', ?, NULL, ?, ?, ?, ?, 1)",
    [`owner-${suffix}`, "not-used", mitraResult.insertId, "Owner Test", `08${suffix}`, `owner-${suffix}@test.local`, "integration-test"]
  );
  const [inactiveResult] = await db.execute(
    "INSERT INTO tbl_users_mobile (username, password, role, idMitra, cabangId, namaLengkap, noTelp, email, createdBy, statusAktif) VALUES (?, ?, 'owner', ?, NULL, ?, ?, ?, ?, 0)",
    [`inactive-${suffix}`, "not-used", mitraResult.insertId, "Inactive Test", `09${suffix}`, `inactive-${suffix}@test.local`, "integration-test"]
  );
  fixture = { idMitra: mitraResult.insertId, cabangId: cabangResult.insertId, ownerId: ownerResult.insertId, inactiveId: inactiveResult.insertId };
  server = await new Promise((resolve) => {
    const instance = createApp().listen(0, "127.0.0.1", () => resolve(instance));
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  await db.execute("DELETE FROM tbl_users_mobile WHERE id IN (?, ?)", [fixture.ownerId, fixture.inactiveId]);
  await db.execute("DELETE FROM tbl_cabang WHERE id = ?", [fixture.cabangId]);
  await db.execute("DELETE FROM tbl_mitra WHERE id = ?", [fixture.idMitra]);
  await db.end();
});

const createToken = (id, idMitra) => jwt.sign({ id, idMitra }, process.env.JWT_SECRET, { expiresIn: "5m" });

test("active owner can access own tenant stock settings", async () => {
  const response = await request(server, `/api/owner/stokmitra/mitra/${fixture.idMitra}`, createToken(fixture.ownerId, fixture.idMitra));
  assert.equal(response.statusCode, 200);
});

test("active owner cannot access another tenant stock settings", async () => {
  const response = await request(server, `/api/owner/stokmitra/mitra/${fixture.idMitra + 99999}`, createToken(fixture.ownerId, fixture.idMitra));
  assert.equal(response.statusCode, 403);
});

test("inactive mobile account is rejected after JWT verification", async () => {
  const response = await request(server, `/api/owner/stokmitra/mitra/${fixture.idMitra}`, createToken(fixture.inactiveId, fixture.idMitra));
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).code, "USER_DEACTIVATED");
});
