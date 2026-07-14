const assert = require("node:assert/strict");
const test = require("node:test");
const TransaksiController = require("../src/controller/transaksi");
const TransaksiModel = require("../src/models/transaksi");

const createResponse = () => ({
  statusCode: null,
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

const validPayload = () => ({
  totalBayar: 20000,
  metodePembayaran: "CASH",
  items: [{ jenisLayanan: "cuci", jumlah: 1, subtotal: 20000 }],
});

const validRequest = (body = validPayload()) => ({
  body,
  user: { id: 11, idMitra: 21, cabangId: 31 },
});

test("createTransaksi preserves the legacy controller contract before business-validation refactor", async (t) => {
  const originalCreateTransaksi = TransaksiModel.createTransaksi;
  const calls = [];

  TransaksiModel.createTransaksi = async (payload) => {
    calls.push(payload);
    return { invoiceNumber: "INV-31-BASELINE-0001", ...payload };
  };

  try {
    await t.test("accepts a valid payload and derives identity from the verified request", async () => {
      const response = createResponse();
      await TransaksiController.createTransaksi(validRequest(), response);

      assert.equal(response.statusCode, 201);
      assert.equal(response.body.success, "Create Data Transaksi Success");
      assert.equal(calls.at(-1).idMitra, 21);
      assert.equal(calls.at(-1).cabangId, 31);
      assert.equal(calls.at(-1).idUserMobile, 11);
    });

    await t.test("preserves numeric-string and two-decimal payload compatibility", async () => {
      const response = createResponse();
      await TransaksiController.createTransaksi(
        validRequest({
          totalBayar: "20000.50",
          metodePembayaran: "CASH",
          items: [{ jenisLayanan: "cuci", jumlah: "1", subtotal: "20000.50" }],
        }),
        response
      );

      assert.equal(response.statusCode, 201);
      assert.equal(calls.at(-1).totalBayar, "20000.50");
    });

    await t.test("rejects legacy invalid transport payloads before calling the model", async () => {
      const cases = [
        { name: "missing identity", req: { body: validPayload(), user: {} }, error: "Token tidak valid" },
        { name: "zero total", body: { ...validPayload(), totalBayar: 0 }, error: "totalBayar wajib diisi dan harus lebih dari 0" },
        { name: "negative total", body: { ...validPayload(), totalBayar: -1 }, error: "totalBayar wajib diisi dan harus lebih dari 0" },
        { name: "non-numeric total", body: { ...validPayload(), totalBayar: "invalid" }, error: "totalBayar wajib diisi dan harus lebih dari 0" },
        { name: "missing payment method", body: { ...validPayload(), metodePembayaran: "" }, error: "metodePembayaran wajib diisi" },
        { name: "empty items", body: { ...validPayload(), items: [] }, error: "items wajib diisi dan minimal 1 item" },
        { name: "non-object item", body: { ...validPayload(), items: [null] }, error: "Format item tidak valid" },
        { name: "invalid service", body: { ...validPayload(), items: [{ jenisLayanan: "steam", jumlah: 1, subtotal: 20000 }] }, error: "jenisLayanan tidak valid" },
        { name: "decimal quantity", body: { ...validPayload(), items: [{ jenisLayanan: "cuci", jumlah: 1.5, subtotal: 20000 }] }, error: "jumlah wajib diisi dan harus integer lebih dari 0" },
        { name: "negative subtotal", body: { ...validPayload(), items: [{ jenisLayanan: "cuci", jumlah: 1, subtotal: -1 }] }, error: "subtotal wajib diisi dan tidak boleh negatif" },
        { name: "missing addon item", body: { ...validPayload(), items: [{ jenisLayanan: "addon_barang", jumlah: 1, subtotal: 20000 }] }, error: "itemId wajib diisi untuk addon_barang" },
        { name: "mismatched total", body: { ...validPayload(), totalBayar: 10000 }, error: "totalBayar harus sama dengan total subtotal items" },
      ];
      const callsBefore = calls.length;

      for (const entry of cases) {
        const response = createResponse();
        await TransaksiController.createTransaksi(entry.req || validRequest(entry.body), response);
        assert.equal(response.statusCode, entry.name === "missing identity" ? 401 : 400, entry.name);
        assert.deepEqual(response.body, { error: entry.error }, entry.name);
      }

      assert.equal(calls.length, callsBefore);
    });

    await t.test("maps current known model errors and preserves the unknown-error transport shape", async () => {
      const response404 = createResponse();
      TransaksiModel.createTransaksi = async () => {
        throw new Error("Item tidak ditemukan");
      };
      await TransaksiController.createTransaksi(validRequest(), response404);
      assert.deepEqual(response404.body, { error: "Item tidak ditemukan" });
      assert.equal(response404.statusCode, 404);

      const response400 = createResponse();
      TransaksiModel.createTransaksi = async () => {
        throw new Error("Stok tidak mencukupi");
      };
      await TransaksiController.createTransaksi(validRequest(), response400);
      assert.deepEqual(response400.body, { error: "Stok tidak mencukupi" });
      assert.equal(response400.statusCode, 400);

      const response500 = createResponse();
      TransaksiModel.createTransaksi = async () => {
        throw new Error("database baseline failure");
      };
      await TransaksiController.createTransaksi(validRequest(), response500);
      assert.equal(response500.statusCode, 500);
      assert.equal(response500.body.serverMessage, "database baseline failure");
    });
  } finally {
    TransaksiModel.createTransaksi = originalCreateTransaksi;
  }
});

test.skip("Fase 5: rejects a client total that is self-consistent but below tbl_harga_cabang", () => {
  // Target security behavior. The integration fixture will provide the official branch price.
});

test.todo("Fase 4: rejects unsafe numeric values before money arithmetic");
