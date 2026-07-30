const assert = require("node:assert/strict");
const test = require("node:test");
const NotifikasiController = require("../src/controller/notifikasi");
const NotifikasiModel = require("../src/models/notifikasi");
const { createHttpError } = require("../src/utils/httpError");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) { this.statusCode = statusCode; return this; },
  json(body) { this.body = body; return this; },
});

test("notification list preserves success response and forwards failures", async () => {
  const original = NotifikasiModel.getNotifikasi;
  NotifikasiModel.getNotifikasi = async () => [{ id: 1, cabangId: 2, tipe: "STOK", referenceId: null, judul: "Stok", pesan: "Menipis", isRead: 0, createdDate: "2026-07-14T00:00:00.000Z" }];

  try {
    const response = createResponse();
    await NotifikasiController.getNotifikasi({ user: { role: "kasir", idMitra: 1, cabangId: 2 }, query: {} }, response);
    assert.equal(response.body.meta.unreadCount, 1);
    assert.equal(response.body.data[0].idNotif, 1);

    const expectedError = new Error("database unavailable");
    NotifikasiModel.getNotifikasi = async () => { throw expectedError; };
    await assert.rejects(
      NotifikasiController.getNotifikasi({ user: { role: "kasir", idMitra: 1, cabangId: 2 }, query: {} }, createResponse()),
      (error) => error === expectedError
    );
  } finally { NotifikasiModel.getNotifikasi = original; }
});

test("notification mark-as-read forwards typed not-found errors", async () => {
  const original = NotifikasiModel.markAsRead;
  const expectedError = createHttpError(404, "Id tidak ditemukan", "NOTIFICATION_NOT_FOUND");
  NotifikasiModel.markAsRead = async () => { throw expectedError; };

  try {
    await assert.rejects(
      NotifikasiController.markAsRead({ params: { id: "1" }, user: { role: "kasir", idMitra: 1, cabangId: 2 } }, createResponse()),
      (error) => error === expectedError
    );
  } finally { NotifikasiModel.markAsRead = original; }
});

test("notification read-all forwards tenant and cashier branch scope", async () => {
  const original = NotifikasiModel.markAllAsRead;
  const received = [];
  NotifikasiModel.markAllAsRead = async (...params) => {
    received.push(params);
    return { updatedCount: 2, isRead: true };
  };

  try {
    const ownerResponse = createResponse();
    await NotifikasiController.markAllAsRead(
      { user: { role: "owner", idMitra: 1, cabangId: 2 } },
      ownerResponse
    );
    const kasirResponse = createResponse();
    await NotifikasiController.markAllAsRead(
      { user: { role: "kasir", idMitra: 1, cabangId: 2 } },
      kasirResponse
    );

    assert.deepEqual(received, [[1, null], [1, 2]]);
    assert.equal(ownerResponse.statusCode, 200);
    assert.deepEqual(ownerResponse.body, {
      success: "Mark All as Read Success",
      data: { updatedCount: 2, isRead: true },
    });
    assert.equal(kasirResponse.statusCode, 200);
  } finally { NotifikasiModel.markAllAsRead = original; }
});
