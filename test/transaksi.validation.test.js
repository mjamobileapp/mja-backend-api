const assert = require("node:assert/strict");
const test = require("node:test");
const { calculateLineSubtotal, normalizeMoney, normalizeTransaksiPayload, sumMoney } = require("../src/domain/transaksi");
const { validateTransaksiPayload } = require("../src/middleware/validateTransaksi");
const TransaksiService = require("../src/services/transaksi");

test("transaction domain normalizes compatible numeric strings without mutating the input", () => {
  const input = {
    namaPelanggan: "  Budi Santoso  ",
    totalBayar: "20000.50",
    metodePembayaran: " CASH ",
    items: [{ jenisLayanan: "cuci", jumlah: "1", subtotal: "20000.50" }],
  };
  const normalized = normalizeTransaksiPayload(input);

  assert.deepEqual(normalized, {
    namaPelanggan: "Budi Santoso",
    totalBayar: 20000.5,
    metodePembayaran: "CASH",
    items: [{ jenisLayanan: "cuci", itemId: null, jumlah: 1, subtotal: 20000.5 }],
  });
  assert.equal(input.items[0].itemId, undefined);
  assert.equal(sumMoney([0.1, 0.2]), 0.3);
  assert.equal(calculateLineSubtotal("20000", 2), 40000);
});

test("transaction domain rejects unsafe and malformed money before arithmetic", () => {
  for (const value of [null, "", true, "invalid", Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => normalizeMoney(value, "invalid money"), /invalid money/);
  }
  assert.throws(
    () => normalizeTransaksiPayload({ namaPelanggan: "Budi", totalBayar: 1, metodePembayaran: "CASH", items: [{ jenisLayanan: "cuci", jumlah: 1, subtotal: 0.001 }] }),
    /totalBayar harus sama/
  );
  assert.throws(
    () => normalizeTransaksiPayload({ namaPelanggan: "A".repeat(101), totalBayar: 1, metodePembayaran: "CASH", items: [{ jenisLayanan: "cuci", jumlah: 1, subtotal: 1 }] }),
    /namaPelanggan maksimal 100 karakter/
  );
});

test("transaction validation errors expose the typed HTTP contract", () => {
  assert.throws(
    () => normalizeMoney("invalid", "Harga transaksi tidak valid"),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "TRANSACTION_VALIDATION_ERROR");
      assert.equal(error.message, "Harga transaksi tidak valid");
      return true;
    }
  );
});

test("transaction validation middleware stores a DTO without overwriting req.body", () => {
  const req = { body: { namaPelanggan: "Budi", totalBayar: "1", metodePembayaran: "CASH", items: [{ jenisLayanan: "cuci", jumlah: "1", subtotal: "1" }] } };
  const res = { statusCode: null, body: null, status(statusCode) { this.statusCode = statusCode; return this; }, json(body) { this.body = body; return this; } };
  let nextCalled = false;

  validateTransaksiPayload(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.body.totalBayar, "1");
  assert.equal(req.validatedBody.totalBayar, 1);
  assert.equal(req.validatedBody.namaPelanggan, "Budi");
});

test("transaction service builds a model command without Express objects", async () => {
  let receivedCommand;
  const result = await TransaksiService.createTransaksi(
    { idMitra: 1, cabangId: 2, idUserMobile: 3, payload: { namaPelanggan: "Budi", totalBayar: 1, metodePembayaran: "CASH", items: [] } },
    { async createTransaksi(command) { receivedCommand = command; return { id: 10 }; } }
  );

  assert.deepEqual(result, { id: 10 });
  assert.deepEqual(receivedCommand, { idMitra: 1, cabangId: 2, idUserMobile: 3, namaPelanggan: "Budi", totalBayar: 1, metodePembayaran: "CASH", items: [] });
});
