require("dotenv").config();

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

process.env.DB_NAME = `${process.env.DB_NAME}_refactor_test`;

test("MySQL DATETIME round-trip remains UTC when the process uses a non-UTC timezone", () => {
  const script = `
    const db = require("./src/config/database");
    const { formatTanggalJamWIB } = require("./src/utils/date");

    (async () => {
      const connection = await db.getConnection();
      try {
        await connection.execute("CREATE TEMPORARY TABLE timezone_roundtrip (value DATETIME NOT NULL)");
        await connection.execute("INSERT INTO timezone_roundtrip (value) VALUES (?)", ["2026-01-31 17:30:45"]);
        const [rows] = await connection.execute("SELECT value FROM timezone_roundtrip");
        console.log(JSON.stringify({
          iso: rows[0].value.toISOString(),
          jakarta: formatTanggalJamWIB(rows[0].value),
        }));
      } finally {
        connection.release();
        await db.end();
      }
    })().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  `;
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    env: { ...process.env, TZ: "America/New_York" },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    iso: "2026-01-31T17:30:45.000Z",
    jakarta: "01/02/2026 00:30 WIB",
  });
});
