require("dotenv").config();

const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const test = require("node:test");

process.env.DB_NAME = `${process.env.DB_NAME}_refactor_test`;

const db = require("../src/config/database");
const { createApp } = require("../src/app");
const { migrateMachineLogActor } = require("../scripts/migrate-machine-log-actor");

const request = (server, { method = "GET", path, token, body }) =>
  new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const address = server.address();
    const headers = {};

    if (token) headers.Authorization = `Bearer ${token}`;
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = http.request(
      { host: "127.0.0.1", port: address.port, path, method, headers },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body: responseBody ? JSON.parse(responseBody) : null });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });

let server;
let fixture;

const mobileToken = () =>
  jwt.sign({ id: fixture.kasirId, idMitra: fixture.idMitra, tokenType: "mobile" }, process.env.JWT_SECRET, { expiresIn: "5m" });
const ownerToken = () =>
  jwt.sign({ id: fixture.ownerId, idMitra: fixture.idMitra, tokenType: "mobile" }, process.env.JWT_SECRET, { expiresIn: "5m" });
const backofficeToken = () =>
  jwt.sign({ id: fixture.backofficeUserId, username: fixture.backofficeUsername, role: fixture.roleId, tokenType: "backoffice" }, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });
const restrictedBackofficeToken = () =>
  jwt.sign(
    {
      id: fixture.restrictedBackofficeUserId,
      username: fixture.restrictedBackofficeUsername,
      role: fixture.restrictedRoleId,
      tokenType: "backoffice",
    },
    process.env.JWT_SECRET,
    { expiresIn: "5m" }
  );

test.before(async () => {
  await migrateMachineLogActor(db);

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [mitra] = await db.execute(
    "INSERT INTO tbl_mitra (kodeMitra, namaMitra, alamatMitra, createdBy, statusAktif) VALUES (?, ?, ?, ?, 1)",
    [`IT-${suffix}`, `Mitra ${suffix}`, "Integration test", "integration-test"]
  );
  const [cabang] = await db.execute(
    "INSERT INTO tbl_cabang (idMitra, kodeCabang, namaCabang, alamatCabang, createdBy, statusAktif) VALUES (?, ?, ?, ?, ?, 1)",
    [mitra.insertId, `CAB-${suffix}`, `Cabang ${suffix}`, "Integration test", "integration-test"]
  );
  const [owner] = await db.execute(
    `INSERT INTO tbl_users_mobile
      (username, password, role, idMitra, cabangId, namaLengkap, noTelp, email, createdBy, statusAktif)
     VALUES (?, ?, 'owner', ?, NULL, ?, ?, ?, ?, 1)`,
    [`owner-${suffix}`, "not-used", mitra.insertId, "Owner Integration", `08${Date.now()}`, `owner-${suffix}@test.local`, "integration-test"]
  );
  const [kasir] = await db.execute(
    `INSERT INTO tbl_users_mobile
      (username, password, role, idMitra, cabangId, namaLengkap, noTelp, email, createdBy, statusAktif)
     VALUES (?, ?, 'kasir', ?, ?, ?, ?, ?, ?, 1)`,
    [`kasir-${suffix}`, "not-used", mitra.insertId, cabang.insertId, "Kasir Integration", `09${Date.now()}`, `kasir-${suffix}@test.local`, "integration-test"]
  );
  const [role] = await db.execute(
    "INSERT INTO tbl_role (namaRole, description, createdBy) VALUES (?, ?, ?)",
    [`Role ${suffix}`, "Integration test", "integration-test"]
  );
  const [roleMenus] = await db.execute("SELECT id FROM tbl_menu WHERE url = ? LIMIT 1", ["/settings/role"]);
  let roleMenuId = roleMenus[0]?.id;
  let createdRoleMenu = false;
  if (!roleMenuId) {
    const [roleMenu] = await db.execute(
      `INSERT INTO tbl_menu (url, namaMenu, parentId, levelMenu, noUrut, createdBy)
       VALUES (?, ?, NULL, ?, ?, ?)`,
      ["/settings/role", `Role Permission ${suffix}`, 1, 999999, "integration-test"]
    );
    roleMenuId = roleMenu.insertId;
    createdRoleMenu = true;
  }
  await db.execute("INSERT INTO tbl_akses (roleId, menuId, akses) VALUES (?, ?, 1)", [role.insertId, roleMenuId]);
  const backofficeUsername = `backoffice-${suffix}`;
  const [backofficeUser] = await db.execute(
    "INSERT INTO tbl_users (username, password, statusAktif, createdBy, nama, roleId) VALUES (?, ?, 1, ?, ?, ?)",
    [backofficeUsername, "not-used", "integration-test", "Backoffice Integration", role.insertId]
  );
  const [restrictedRole] = await db.execute(
    "INSERT INTO tbl_role (namaRole, description, createdBy) VALUES (?, ?, ?)",
    [`Restricted Role ${suffix}`, "No backoffice menu access", "integration-test"]
  );
  const restrictedBackofficeUsername = `restricted-backoffice-${suffix}`;
  const [restrictedBackofficeUser] = await db.execute(
    "INSERT INTO tbl_users (username, password, statusAktif, createdBy, nama, roleId) VALUES (?, ?, 1, ?, ?, ?)",
    [restrictedBackofficeUsername, "not-used", "integration-test", "Restricted Backoffice", restrictedRole.insertId]
  );
  const [item] = await db.execute(
    "INSERT INTO tbl_master_item_expense (namaItem, tipeItem, createdBy, statusAktif) VALUES (?, 'stok', ?, 1)",
    [`Item ${suffix}`, "integration-test"]
  );
  await db.execute(
    `INSERT INTO tbl_harga_cabang (idMitra, cabangId, jenisLayanan, itemId, harga, createdBy)
     VALUES (?, ?, 'cuci', NULL, ?, ?), (?, ?, 'kering', NULL, ?, ?), (?, ?, 'addon_barang', ?, ?, ?)`,
    [
      mitra.insertId,
      cabang.insertId,
      20000,
      "integration-test",
      mitra.insertId,
      cabang.insertId,
      15000,
      "integration-test",
      mitra.insertId,
      cabang.insertId,
      item.insertId,
      5000,
      "integration-test",
    ]
  );
  const [mesinMaster] = await db.execute(
    `INSERT INTO tbl_mesin_master (idMitra, cabangId, espId, namaGroupMesin, createdBy, statusAktif)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [mitra.insertId, cabang.insertId, `ESP-${suffix}`, "Mesin Fixture", "integration-test"]
  );
  const [mesinDetail] = await db.execute(
    "INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, status) VALUES (?, 'WASHER', 'READY')",
    [mesinMaster.insertId]
  );
  const [parentMenu] = await db.execute(
    `INSERT INTO tbl_menu (url, namaMenu, parentId, levelMenu, noUrut, createdBy)
     VALUES (?, ?, NULL, ?, ?, ?)`,
    ["/integration", "Integration Parent", 1, 1, "integration-test"]
  );
  const [childMenu] = await db.execute(
    `INSERT INTO tbl_menu (url, namaMenu, parentId, levelMenu, noUrut, createdBy)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ["/integration/child", "Integration Child", parentMenu.insertId, 2, 2, "integration-test"]
  );

  fixture = {
    idMitra: mitra.insertId,
    cabangId: cabang.insertId,
    ownerId: owner.insertId,
    kasirId: kasir.insertId,
    roleId: role.insertId,
    roleMenuId,
    createdRoleMenu,
    backofficeUserId: backofficeUser.insertId,
    backofficeUsername,
    restrictedRoleId: restrictedRole.insertId,
    restrictedBackofficeUserId: restrictedBackofficeUser.insertId,
    restrictedBackofficeUsername,
    itemId: item.insertId,
    mesinMasterIds: [mesinMaster.insertId],
    mesinDetailId: mesinDetail.insertId,
    parentMenuId: parentMenu.insertId,
    childMenuId: childMenu.insertId,
  };

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

  const masterIds = fixture.mesinMasterIds;
  await db.execute(`DELETE FROM tbl_log_mesin WHERE idMitra = ?`, [fixture.idMitra]);
  await db.execute(`DELETE d FROM tbl_detail_order d JOIN tbl_order_laundry o ON o.id = d.orderId WHERE o.idMitra = ?`, [fixture.idMitra]);
  await db.execute("DELETE FROM tbl_order_laundry WHERE idMitra = ?", [fixture.idMitra]);
  await db.execute("DELETE FROM tbl_pengeluaran WHERE idMitra = ?", [fixture.idMitra]);
  await db.execute("DELETE FROM tbl_notifikasi WHERE idMitra = ?", [fixture.idMitra]);
  await db.execute("DELETE FROM tbl_stok_cabang WHERE idMitra = ?", [fixture.idMitra]);
  await db.execute("DELETE FROM tbl_harga_cabang WHERE idMitra = ?", [fixture.idMitra]);
  for (const masterId of masterIds) {
    await db.execute("DELETE FROM tbl_mesin_detail WHERE idMesinMaster = ?", [masterId]);
    await db.execute("DELETE FROM tbl_mesin_master WHERE id = ?", [masterId]);
  }
  await db.execute("DELETE FROM tbl_akses WHERE roleId = ?", [fixture.roleId]);
  await db.execute("DELETE FROM tbl_menu WHERE id IN (?, ?)", [fixture.parentMenuId, fixture.childMenuId]);
  if (fixture.createdRoleMenu) {
    await db.execute("DELETE FROM tbl_menu WHERE id = ?", [fixture.roleMenuId]);
  }
  await db.execute("DELETE FROM tbl_users WHERE id IN (?, ?)", [fixture.backofficeUserId, fixture.restrictedBackofficeUserId]);
  await db.execute("DELETE FROM tbl_role WHERE id = ?", [fixture.roleId]);
  await db.execute("DELETE FROM tbl_role WHERE id = ?", [fixture.restrictedRoleId]);
  await db.execute("DELETE FROM tbl_master_item_expense WHERE id = ?", [fixture.itemId]);
  await db.execute("DELETE FROM tbl_users_mobile WHERE id IN (?, ?)", [fixture.ownerId, fixture.kasirId]);
  await db.execute("DELETE FROM tbl_cabang WHERE id = ?", [fixture.cabangId]);
  await db.execute("DELETE FROM tbl_mitra WHERE id = ?", [fixture.idMitra]);
  await db.end();
});

test("core domains complete their HTTP flows on the isolated integration schema", async (t) => {
  await t.test("mobile token cannot impersonate a backoffice account with the same id", async () => {
    const collidingMobileToken = jwt.sign(
      {
        id: fixture.backofficeUserId,
        username: "mobile-user-with-colliding-id",
        role: 2,
        idMitra: fixture.idMitra,
        tokenType: "mobile",
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    const response = await request(server, {
      path: "/api/backoffice/dashboard/getmitra",
      token: collidingMobileToken,
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.code, "INVALID_TOKEN_TYPE");
  });

  await t.test("backoffice token must match the current database identity", async () => {
    const mismatchedBackofficeToken = jwt.sign(
      {
        id: fixture.backofficeUserId,
        username: "different-backoffice-username",
        role: fixture.roleId,
        tokenType: "backoffice",
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );

    const response = await request(server, {
      path: "/api/backoffice/dashboard/getmitra",
      token: mismatchedBackofficeToken,
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.code, "TOKEN_IDENTITY_MISMATCH");
  });

  await t.test("backoffice API denies a role without the required menu permission", async () => {
    const requests = [
      {
        method: "POST",
        path: "/api/backoffice/users",
        token: restrictedBackofficeToken(),
      },
      {
        method: "POST",
        path: "/api/backoffice/roles",
        token: restrictedBackofficeToken(),
      },
      {
        method: "POST",
        path: `/api/backoffice/akses/role/${fixture.roleId}`,
        token: restrictedBackofficeToken(),
      },
    ];

    for (const requestOptions of requests) {
      const response = await request(server, requestOptions);
      assert.equal(response.statusCode, 403);
      assert.equal(response.body.code, "FORBIDDEN");
    }
  });

  await t.test("notification mark-as-read is restricted to the authenticated tenant and cashier branch", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [otherCabang] = await db.execute(
      "INSERT INTO tbl_cabang (idMitra, kodeCabang, namaCabang, alamatCabang, createdBy, statusAktif) VALUES (?, ?, ?, ?, ?, 1)",
      [fixture.idMitra, `NOTIF-CAB-${suffix}`, `Notifikasi Cabang ${suffix}`, "Integration test", "integration-test"]
    );
    const [foreignMitra] = await db.execute(
      "INSERT INTO tbl_mitra (kodeMitra, namaMitra, alamatMitra, createdBy, statusAktif) VALUES (?, ?, ?, ?, 1)",
      [`NOTIF-${suffix}`, `Notifikasi Mitra ${suffix}`, "Integration test", "integration-test"]
    );
    const [foreignCabang] = await db.execute(
      "INSERT INTO tbl_cabang (idMitra, kodeCabang, namaCabang, alamatCabang, createdBy, statusAktif) VALUES (?, ?, ?, ?, ?, 1)",
      [foreignMitra.insertId, `NOTIF-FOREIGN-${suffix}`, `Notifikasi Foreign ${suffix}`, "Integration test", "integration-test"]
    );
    const [ownNotification] = await db.execute(
      "INSERT INTO tbl_notifikasi (idMitra, cabangId, tipe, judul, pesan) VALUES (?, ?, ?, ?, ?)",
      [fixture.idMitra, fixture.cabangId, "TEST", "Own notification", "Notification within tenant"]
    );
    const [otherBranchNotification] = await db.execute(
      "INSERT INTO tbl_notifikasi (idMitra, cabangId, tipe, judul, pesan) VALUES (?, ?, ?, ?, ?)",
      [fixture.idMitra, otherCabang.insertId, "TEST", "Other branch notification", "Notification on another branch"]
    );
    const [foreignNotification] = await db.execute(
      "INSERT INTO tbl_notifikasi (idMitra, cabangId, tipe, judul, pesan) VALUES (?, ?, ?, ?, ?)",
      [foreignMitra.insertId, foreignCabang.insertId, "TEST", "Foreign notification", "Notification in another tenant"]
    );

    try {
      const ownResponse = await request(server, {
        method: "PUT",
        path: `/api/mobile/notifications/${ownNotification.insertId}/read`,
        token: ownerToken(),
      });
      const foreignResponse = await request(server, {
        method: "PUT",
        path: `/api/mobile/notifications/${foreignNotification.insertId}/read`,
        token: ownerToken(),
      });
      const otherBranchResponse = await request(server, {
        method: "PUT",
        path: `/api/mobile/notifications/${otherBranchNotification.insertId}/read`,
        token: mobileToken(),
      });
      const [notifications] = await db.execute(
        "SELECT id, isRead FROM tbl_notifikasi WHERE id IN (?, ?, ?)",
        [ownNotification.insertId, otherBranchNotification.insertId, foreignNotification.insertId]
      );
      const isReadById = new Map(notifications.map((notification) => [notification.id, notification.isRead]));

      assert.equal(ownResponse.statusCode, 200);
      assert.equal(foreignResponse.statusCode, 404);
      assert.equal(otherBranchResponse.statusCode, 404);
      assert.equal(isReadById.get(ownNotification.insertId), 1);
      assert.equal(isReadById.get(otherBranchNotification.insertId), 0);
      assert.equal(isReadById.get(foreignNotification.insertId), 0);
    } finally {
      await db.execute("DELETE FROM tbl_notifikasi WHERE id IN (?, ?, ?)", [
        ownNotification.insertId,
        otherBranchNotification.insertId,
        foreignNotification.insertId,
      ]);
      await db.execute("DELETE FROM tbl_cabang WHERE id IN (?, ?)", [otherCabang.insertId, foreignCabang.insertId]);
      await db.execute("DELETE FROM tbl_mitra WHERE id = ?", [foreignMitra.insertId]);
    }
  });

  await t.test("mesin CRUD, dashboard, and mobile machine list", async () => {
    const create = await request(server, {
      method: "POST",
      path: "/api/backoffice/mesin",
      token: backofficeToken(),
      body: { idMitra: fixture.idMitra, cabangId: fixture.cabangId, espId: `ESP-NEW-${Date.now()}`, washer: 1, dryer: 1 },
    });
    assert.equal(create.statusCode, 201);

    const [createdMasters] = await db.execute(
      "SELECT id FROM tbl_mesin_master WHERE idMitra = ? AND cabangId = ? AND espId = ?",
      [fixture.idMitra, fixture.cabangId, create.body.data.espId]
    );
    const createdMasterId = createdMasters[0].id;
    fixture.mesinMasterIds.push(createdMasterId);

    const getById = await request(server, { path: `/api/backoffice/mesin/${createdMasterId}`, token: backofficeToken() });
    const list = await request(server, { path: "/api/backoffice/mesin?status=all", token: backofficeToken() });
    const mobileList = await request(server, { path: `/api/backoffice/mesin/list/cabang/${fixture.cabangId}`, token: mobileToken() });
    const backofficeList = await request(server, { path: `/api/backoffice/mesin/list/cabang/${fixture.cabangId}`, token: backofficeToken() });
    assert.equal(getById.statusCode, 200);
    assert.equal(list.statusCode, 200);
    assert.equal(mobileList.statusCode, 200);
    assert.equal(backofficeList.statusCode, 200);

    const [details] = await db.execute("SELECT id FROM tbl_mesin_detail WHERE idMesinMaster = ? ORDER BY id", [createdMasterId]);
    const maintenance = await request(server, { method: "PUT", path: `/api/backoffice/mesin/maintenance/${details[0].id}`, token: backofficeToken() });
    const ready = await request(server, { method: "PUT", path: `/api/backoffice/mesin/ready/${details[0].id}`, token: backofficeToken() });
    const remove = await request(server, { method: "DELETE", path: `/api/backoffice/mesin/${createdMasterId}`, token: backofficeToken() });
    const restore = await request(server, { method: "POST", path: `/api/backoffice/mesin/${createdMasterId}/restore`, token: backofficeToken() });
    assert.equal(maintenance.statusCode, 200);
    assert.equal(ready.statusCode, 200);
    assert.equal(remove.statusCode, 200);
    assert.equal(restore.statusCode, 200);

    for (const path of ["/api/backoffice/dashboard/getmitra", "/api/backoffice/dashboard/getcabang", "/api/backoffice/dashboard/getmesin"]) {
      const response = await request(server, { path, token: backofficeToken() });
      assert.equal(response.statusCode, 200, path);
    }
  });

  await t.test("akses tree can be read, saved, and resolved for a user", async () => {
    const initial = await request(server, { path: `/api/backoffice/akses/role/${fixture.roleId}`, token: backofficeToken() });
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.body[0].checked, false);

    const save = await request(server, {
      method: "POST",
      path: `/api/backoffice/akses/role/${fixture.roleId}`,
      token: backofficeToken(),
      body: [
        { id: fixture.parentMenuId, checked: true, children: [{ id: fixture.childMenuId, checked: true }] },
        { id: fixture.roleMenuId, checked: true },
      ],
    });
    const roleAccess = await request(server, { path: `/api/backoffice/akses/role/${fixture.roleId}`, token: backofficeToken() });
    const userAccess = await request(server, {
      path: `/api/backoffice/akses/user/${encodeURIComponent(fixture.backofficeUsername)}`,
      token: backofficeToken(),
    });
    assert.equal(save.statusCode, 200);
    assert.equal(roleAccess.body[0].checked, true);
    assert.equal(userAccess.statusCode, 200);
    assert.equal(userAccess.body[0].items[0].children[0].link, "/integration/child");
  });

  await t.test("transaksi, pending queue, and history use the authenticated branch and tenant", async () => {
    const create = await request(server, {
      method: "POST",
      path: "/api/kasir/transaksi",
      token: mobileToken(),
      body: { totalBayar: 20000, metodePembayaran: "CASH", items: [{ jenisLayanan: "cuci", jumlah: 1, subtotal: 20000 }] },
    });
    assert.equal(create.statusCode, 201);
    assert.match(create.body.data.invoiceNumber, new RegExp(`^INV-${fixture.cabangId}-`));

    const count = await request(server, { path: "/api/kasir/transaksi?filter=hari_ini", token: mobileToken() });
    const pending = await request(server, { path: "/api/kasir/transaksi/pending", token: mobileToken() });
    const invalidStart = await request(server, { method: "POST", path: "/api/kasir/transaksi/startmesin", token: mobileToken(), body: {} });
    assert.equal(count.statusCode, 200);
    assert.equal(count.body.data.Total, 1);
    assert.equal(pending.statusCode, 200);
    assert.equal(pending.body.data[0].invoiceNumber, create.body.data.invoiceNumber);
    assert.equal(invalidStart.statusCode, 400);

    await db.execute(
      `INSERT INTO tbl_log_mesin
        (idMitra, cabangId, mesinId, kasirId, actorType, actorId, actorUsername, invoiceNumber, statusPerintah)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success'), (?, ?, ?, NULL, ?, ?, ?, NULL, 'success'), (?, ?, ?, NULL, ?, ?, ?, NULL, 'success')`,
      [
        fixture.idMitra,
        fixture.cabangId,
        fixture.mesinDetailId,
        fixture.kasirId,
        "kasir",
        fixture.kasirId,
        "kasir-audit",
        create.body.data.invoiceNumber,
        fixture.idMitra,
        fixture.cabangId,
        fixture.mesinDetailId,
        "owner",
        fixture.ownerId,
        "owner-audit",
        fixture.idMitra,
        fixture.cabangId,
        fixture.mesinDetailId,
        "backoffice",
        fixture.backofficeUserId,
        fixture.backofficeUsername,
      ]
    );
    const ownerHistory = await request(server, { path: `/api/owner/history/transaksi?cabangId=${fixture.cabangId}`, token: ownerToken() });
    const kasirHistory = await request(server, { path: "/api/kasir/history/transaksi", token: mobileToken() });
    const machineHistory = await request(server, { path: `/api/owner/history/mesin?cabangId=${fixture.cabangId}`, token: ownerToken() });
    assert.equal(ownerHistory.statusCode, 200);
    assert.equal(kasirHistory.statusCode, 200);
    assert.equal(machineHistory.statusCode, 200);
    const machineOperators = machineHistory.body.data.map((log) => log.namaOperator);
    assert.ok(machineOperators.includes("Kasir Integration"));
    assert.ok(machineOperators.includes("owner-audit"));
    assert.ok(machineOperators.includes(fixture.backofficeUsername));
  });

  await t.test("absensi only permits the authenticated tenant and cashier branch", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [foreignMitra] = await db.execute(
      "INSERT INTO tbl_mitra (kodeMitra, namaMitra, alamatMitra, createdBy, statusAktif) VALUES (?, ?, ?, ?, 1)",
      [`FOREIGN-${suffix}`, `Foreign Mitra ${suffix}`, "Integration test", "integration-test"]
    );
    const [foreignCabang] = await db.execute(
      "INSERT INTO tbl_cabang (idMitra, kodeCabang, namaCabang, alamatCabang, createdBy, statusAktif) VALUES (?, ?, ?, ?, ?, 1)",
      [foreignMitra.insertId, `FOREIGN-CAB-${suffix}`, `Foreign Cabang ${suffix}`, "Integration test", "integration-test"]
    );

    try {
      const kasirOwnCabang = await request(server, {
        path: `/api/kasir/absensi?cabangId=${fixture.cabangId}`,
        token: mobileToken(),
      });
      const kasirForeignCabang = await request(server, {
        path: `/api/kasir/absensi?cabangId=${foreignCabang.insertId}`,
        token: mobileToken(),
      });
      const ownerForeignMitra = await request(server, {
        path: `/api/owner/kasir/absensi?cabangId=${foreignCabang.insertId}`,
        token: ownerToken(),
      });

      assert.equal(kasirOwnCabang.statusCode, 200);
      assert.equal(kasirForeignCabang.statusCode, 403);
      assert.equal(ownerForeignMitra.statusCode, 403);
    } finally {
      await db.execute("DELETE FROM tbl_cabang WHERE id = ?", [foreignCabang.insertId]);
      await db.execute("DELETE FROM tbl_mitra WHERE id = ?", [foreignMitra.insertId]);
    }
  });

  await t.test("owner and cashier route families reject the wrong mobile role", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [otherCabang] = await db.execute(
      "INSERT INTO tbl_cabang (idMitra, kodeCabang, namaCabang, alamatCabang, createdBy, statusAktif) VALUES (?, ?, ?, ?, ?, 1)",
      [fixture.idMitra, `OTHER-CAB-${suffix}`, `Other Cabang ${suffix}`, "Integration test", "integration-test"]
    );
    const [otherKasir] = await db.execute(
      `INSERT INTO tbl_users_mobile
        (username, password, role, idMitra, cabangId, namaLengkap, noTelp, email, createdBy, statusAktif)
       VALUES (?, ?, 'kasir', ?, ?, ?, ?, ?, ?, 1)`,
      [`other-kasir-${suffix}`, "not-used", fixture.idMitra, otherCabang.insertId, "Other Kasir", `07${Date.now()}`, `other-kasir-${suffix}@test.local`, "integration-test"]
    );
    const [otherExpense] = await db.execute(
      `INSERT INTO tbl_pengeluaran (idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal, waktuPengeluaran)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [fixture.idMitra, otherCabang.insertId, otherKasir.insertId, fixture.itemId, 1, 5000]
    );

    try {
      const kasirOwnerManagement = await request(server, { path: "/api/owner/kasir", token: mobileToken() });
      const kasirOwnerAbsensi = await request(server, { path: `/api/owner/kasir/absensi?cabangId=${fixture.cabangId}`, token: mobileToken() });
      const kasirStok = await request(server, { path: "/api/owner/stokmitra", token: mobileToken() });
      const kasirHarga = await request(server, { path: `/api/owner/settingharga?cabangId=${fixture.cabangId}`, token: mobileToken() });
      const kasirOwnerHistory = await request(server, { path: `/api/owner/history/transaksi?cabangId=${fixture.cabangId}`, token: mobileToken() });
      const kasirOwnerMachineHistory = await request(server, { path: `/api/owner/history/mesin?cabangId=${fixture.cabangId}`, token: mobileToken() });
      const kasirCashflow = await request(server, { path: `/api/owner/cashflow?cabangId=${fixture.cabangId}`, token: mobileToken() });
      const kasirIncome = await request(server, { path: `/api/owner/cashflow/pendapatan?cabangId=${fixture.cabangId}`, token: mobileToken() });
      const kasirOtherBranchExpense = await request(server, { path: `/api/owner/cashflow/pengeluaran?cabangId=${otherCabang.insertId}`, token: mobileToken() });
      const kasirOtherExpenseDetail = await request(server, { path: `/api/owner/cashflow/pengeluaran/${otherExpense.insertId}`, token: mobileToken() });
      const kasirOtherExpenseUpdate = await request(server, {
        method: "PUT",
        path: `/api/owner/cashflow/pengeluaran/${otherExpense.insertId}`,
        token: mobileToken(),
        body: { itemId: fixture.itemId, jumlahBarang: 2, nominal: 7000 },
      });
      const kasirOtherExpenseDelete = await request(server, {
        method: "DELETE",
        path: `/api/owner/cashflow/pengeluaran/${otherExpense.insertId}`,
        token: mobileToken(),
      });
      const ownerOtherBranchExpense = await request(server, {
        path: `/api/owner/cashflow/pengeluaran?cabangId=${otherCabang.insertId}`,
        token: ownerToken(),
      });
      const ownerKasirAbsensi = await request(server, { path: "/api/kasir/absensi", token: ownerToken() });
      const ownerKasirHistory = await request(server, { path: "/api/kasir/history/transaksi", token: ownerToken() });
      const ownerKasirTransaction = await request(server, { path: "/api/kasir/transaksi", token: ownerToken() });

      for (const response of [
        kasirOwnerManagement,
        kasirOwnerAbsensi,
        kasirStok,
        kasirHarga,
        kasirOwnerHistory,
        kasirOwnerMachineHistory,
        kasirCashflow,
        kasirIncome,
        kasirOtherBranchExpense,
        ownerKasirAbsensi,
        ownerKasirHistory,
        ownerKasirTransaction,
      ]) {
        assert.equal(response.statusCode, 403);
      }
      for (const response of [kasirOtherExpenseDetail, kasirOtherExpenseUpdate, kasirOtherExpenseDelete]) {
        assert.equal(response.statusCode, 404);
      }
      assert.equal(ownerOtherBranchExpense.statusCode, 200);
    } finally {
      await db.execute("DELETE FROM tbl_pengeluaran WHERE id = ?", [otherExpense.insertId]);
      await db.execute("DELETE FROM tbl_users_mobile WHERE id = ?", [otherKasir.insertId]);
      await db.execute("DELETE FROM tbl_cabang WHERE id = ?", [otherCabang.insertId]);
    }
  });

  await t.test("machine-control alias scopes owner and backoffice while rejecting kasir", async () => {
    const ownerStart = await request(server, {
      method: "POST",
      path: "/api/transaksi/startmesin",
      token: ownerToken(),
      body: { mesinId: fixture.mesinDetailId, invoiceNumber: "MISSING-OWNER", cabangId: fixture.cabangId },
    });
    const backofficeStart = await request(server, {
      method: "POST",
      path: "/api/transaksi/startmesin",
      token: backofficeToken(),
      body: {
        mesinId: fixture.mesinDetailId,
        invoiceNumber: "MISSING-BACKOFFICE",
        idMitra: fixture.idMitra,
        cabangId: fixture.cabangId,
      },
    });
    const kasirAlias = await request(server, {
      method: "POST",
      path: "/api/transaksi/startmesin",
      token: mobileToken(),
      body: { mesinId: fixture.mesinDetailId, invoiceNumber: "MISSING-KASIR", cabangId: fixture.cabangId },
    });
    const ownerForeignCabang = await request(server, {
      method: "POST",
      path: "/api/transaksi/startmesin",
      token: ownerToken(),
      body: { mesinId: fixture.mesinDetailId, invoiceNumber: "MISSING-FOREIGN", cabangId: 999999 },
    });
    const backofficeMismatchedScope = await request(server, {
      method: "POST",
      path: "/api/transaksi/startmesin",
      token: backofficeToken(),
      body: {
        mesinId: fixture.mesinDetailId,
        invoiceNumber: "MISSING-MISMATCHED",
        idMitra: 999999,
        cabangId: fixture.cabangId,
      },
    });

    assert.equal(ownerStart.statusCode, 404);
    assert.equal(backofficeStart.statusCode, 404);
    assert.equal(kasirAlias.statusCode, 403);
    assert.equal(ownerForeignCabang.statusCode, 403);
    assert.equal(backofficeMismatchedScope.statusCode, 403);
  });

  await t.test("cashflow supports summary, income, owner and cashier expenses, detail, update, and delete", async () => {
    const create = await request(server, {
      method: "POST",
      path: "/api/owner/cashflow/pengeluaran",
      token: mobileToken(),
      body: { itemId: fixture.itemId, jumlahBarang: 2, nominal: 5000 },
    });
    assert.equal(create.statusCode, 201);
    const expenseId = create.body.data.id;

    const summary = await request(server, { path: `/api/owner/cashflow?cabangId=${fixture.cabangId}&filter=hari_ini`, token: ownerToken() });
    const income = await request(server, { path: `/api/owner/cashflow/pendapatan?cabangId=${fixture.cabangId}`, token: ownerToken() });
    const ownerExpenses = await request(server, { path: `/api/owner/cashflow/pengeluaran?cabangId=${fixture.cabangId}`, token: ownerToken() });
    const cashierExpenses = await request(server, { path: "/api/owner/cashflow/pengeluaran", token: mobileToken() });
    const detail = await request(server, { path: `/api/owner/cashflow/pengeluaran/${expenseId}`, token: ownerToken() });
    assert.equal(summary.statusCode, 200);
    assert.equal(summary.body.data.sisaKas, "15000.00");
    assert.equal(income.statusCode, 200);
    assert.equal(ownerExpenses.statusCode, 200);
    assert.equal(cashierExpenses.statusCode, 200);
    assert.equal(detail.statusCode, 200);

    const update = await request(server, {
      method: "PUT",
      path: `/api/owner/cashflow/pengeluaran/${expenseId}`,
      token: ownerToken(),
      body: { itemId: fixture.itemId, jumlahBarang: 3, nominal: 7000 },
    });
    const remove = await request(server, {
      method: "DELETE",
      path: `/api/owner/cashflow/pengeluaran/${expenseId}`,
      token: ownerToken(),
    });
    const [deleted] = await db.execute("SELECT statusAktif FROM tbl_pengeluaran WHERE id = ?", [expenseId]);
    assert.equal(update.statusCode, 200);
    assert.equal(remove.statusCode, 200);
    assert.equal(deleted[0].statusAktif, 0);
  });
});
