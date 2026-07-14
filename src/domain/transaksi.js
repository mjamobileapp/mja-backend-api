const validJenisLayanan = new Set(["cuci", "kering", "addon_barang"]);
const MAX_MONEY = 9999999999.99;

const createValidationError = (message) => {
  const error = new Error(message);
  error.code = "TRANSACTION_VALIDATION_ERROR";
  return error;
};

const normalizeMoney = (value, message, { positive = false } = {}) => {
  if (typeof value === "boolean" || value === null || value === "") {
    throw createValidationError(message);
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || !Number.isSafeInteger(Math.round(numberValue * 100)) || numberValue > MAX_MONEY || (positive ? numberValue <= 0 : numberValue < 0)) {
    throw createValidationError(message);
  }

  return Number(numberValue.toFixed(2));
};

const normalizePositiveInteger = (value, message) => {
  if (typeof value === "boolean" || !Number.isInteger(Number(value)) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))) {
    throw createValidationError(message);
  }

  return Number(value);
};

const sumMoney = (values) => {
  const cents = values.reduce((sum, value) => sum + Math.round(value * 100), 0);
  if (!Number.isSafeInteger(cents)) throw createValidationError("Nilai transaksi terlalu besar");
  return cents / 100;
};

const normalizeTransaksiPayload = (body = {}) => {
  const totalBayar = normalizeMoney(body.totalBayar, "totalBayar wajib diisi dan harus lebih dari 0", { positive: true });
  if (typeof body.metodePembayaran !== "string" || body.metodePembayaran.trim() === "") {
    throw createValidationError("metodePembayaran wajib diisi");
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createValidationError("items wajib diisi dan minimal 1 item");
  }

  const items = body.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw createValidationError("Format item tidak valid");
    if (!validJenisLayanan.has(item.jenisLayanan)) throw createValidationError("jenisLayanan tidak valid");

    const normalizedItem = {
      jenisLayanan: item.jenisLayanan,
      itemId: null,
      jumlah: normalizePositiveInteger(item.jumlah, "jumlah wajib diisi dan harus integer lebih dari 0"),
      subtotal: normalizeMoney(item.subtotal, "subtotal wajib diisi dan tidak boleh negatif"),
    };
    if (item.jenisLayanan === "addon_barang") {
      normalizedItem.itemId = normalizePositiveInteger(item.itemId, "itemId wajib diisi untuk addon_barang");
    }
    return normalizedItem;
  });

  if (sumMoney(items.map((item) => item.subtotal)) !== totalBayar) {
    throw createValidationError("totalBayar harus sama dengan total subtotal items");
  }

  return { totalBayar, metodePembayaran: body.metodePembayaran.trim(), items };
};

module.exports = { normalizeMoney, normalizeTransaksiPayload, sumMoney };
