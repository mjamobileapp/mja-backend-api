const dbPool = require("../config/database");
const { withTransaction } = require("../utils/transaction");
const { createHttpError } = require("../utils/httpError");

const SUPPORTED_SERVICE_TYPES = new Set(["cuci", "kering", "addon_barang"]);

const getLogicalPriceKey = ({ jenisLayanan, itemId }) =>
  `${jenisLayanan}:${jenisLayanan === "addon_barang" ? Number(itemId) : "null"}`;

const validatePriceItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, "item harus berupa array dan tidak boleh kosong", "BRANCH_PRICE_INVALID");
  }

  const seenKeys = new Set();

  items.forEach((item, index) => {
    const itemNumber = index + 1;
    if (!item || !SUPPORTED_SERVICE_TYPES.has(item.jenisLayanan)) {
      throw createHttpError(
        400,
        `jenisLayanan tidak valid untuk item ke-${itemNumber}`,
        "BRANCH_PRICE_INVALID"
      );
    }

    if (item.jenisLayanan === "addon_barang") {
      const rawItemId = item.itemId;
      const itemId = Number(rawItemId);
      const validItemIdType =
        (typeof rawItemId === "number" || typeof rawItemId === "string") &&
        String(rawItemId).trim() !== "";
      if (!validItemIdType || !Number.isSafeInteger(itemId) || itemId <= 0) {
        throw createHttpError(
          400,
          `itemId wajib berupa integer positif untuk item ke-${itemNumber}`,
          "BRANCH_PRICE_INVALID"
        );
      }
    }

    const rawHarga = item.harga;
    const harga = Number(rawHarga);
    const validHargaType =
      (typeof rawHarga === "number" || typeof rawHarga === "string") &&
      String(rawHarga).trim() !== "";
    if (!validHargaType || !Number.isFinite(harga) || harga <= 0) {
      throw createHttpError(
        400,
        `harga wajib berupa angka lebih dari 0 untuk item ke-${itemNumber}`,
        "BRANCH_PRICE_INVALID"
      );
    }

    const key = getLogicalPriceKey(item);
    if (seenKeys.has(key)) {
      throw createHttpError(
        400,
        `Kombinasi harga duplikat: ${key}`,
        "BRANCH_PRICE_DUPLICATE"
      );
    }
    seenKeys.add(key);
  });
};

const createSettingHarga = async (idMitra, cabangId, items, createdBy) => {
  validatePriceItems(items);

  return withTransaction(async (connection) => {
    // 1. Validasi idMitra
    const [mitraCheck] = await connection.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
      [idMitra]
    );
    if (mitraCheck.length === 0) {
      throw createHttpError(404, "Mitra tidak ditemukan", "MITRA_NOT_FOUND");
    }

    // 2. Validasi cabangId
    const [cabangCheck] = await connection.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = 1 FOR UPDATE",
      [cabangId, idMitra]
    );
    if (cabangCheck.length === 0) {
      throw createHttpError(404, "Cabang tidak ditemukan", "CABANG_NOT_FOUND");
    }

    // 3. DELETE data lama untuk idMitra & cabangId ini
    await connection.execute(
      "DELETE FROM tbl_harga_cabang WHERE idMitra = ? AND cabangId = ?",
      [idMitra, cabangId]
    );

    // 4. INSERT data baru untuk setiap item
    const insertedData = [];
    for (const item of items) {
      const { jenisLayanan, itemId, harga } = item;

      const [result] = await connection.execute(
        `INSERT INTO tbl_harga_cabang (idMitra, cabangId, jenisLayanan, itemId, harga, createdBy)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idMitra, cabangId, jenisLayanan, itemId || null, harga, createdBy]
      );

      insertedData.push({
        id: result.insertId,
        idMitra: idMitra,
        cabangId: cabangId,
        jenisLayanan: jenisLayanan,
        itemId: itemId || null,
        harga: harga,
        createdBy: createdBy,
      });
    }

    return insertedData;
  });
};

const getSettingHarga = async (idMitra, cabangId) => {
    // 1. Validasi idMitra
    const [mitraCheck] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
      [idMitra]
    );
    if (mitraCheck.length === 0) {
      throw createHttpError(404, "Mitra tidak ditemukan", "MITRA_NOT_FOUND");
    }

    // 2. Validasi cabangId
    const [cabangCheck] = await dbPool.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = 1",
      [cabangId, idMitra]
    );
    if (cabangCheck.length === 0) {
      throw createHttpError(404, "Cabang tidak ditemukan", "CABANG_NOT_FOUND");
    }

    // 3. Ambil data setting harga
    const [rows] = await dbPool.execute(
      `WITH TemplateLayanan AS (
    -- Menentukan struktur kategori layanan statis
    SELECT 'cuci' AS jenisLayanan, NULL AS itemId
    UNION ALL
    SELECT 'kering' AS jenisLayanan, NULL AS itemId
    UNION ALL
    SELECT 'addon_barang' AS jenisLayanan, id AS itemId
    FROM tbl_master_item_expense
    WHERE tipeItem = 'stok' and statusAktif = 1
)
SELECT 
    t.jenisLayanan, 
    t.itemId, 
    IFNULL(h.harga, 0) AS harga,
    IFNULL(s.stokSekarang, 0) AS stokSekarang
FROM TemplateLayanan t
LEFT JOIN tbl_harga_cabang h ON 
    h.cabangId = ? AND 
    h.idMitra = ? AND
    h.jenisLayanan = t.jenisLayanan AND 
    (h.itemId = t.itemId OR (h.itemId IS NULL AND t.itemId IS NULL))
LEFT JOIN tbl_stok_cabang s ON
    s.idMitra = ? AND
    s.cabangId = ? AND
    s.itemId = t.itemId
ORDER BY 
    CASE t.jenisLayanan
        WHEN 'cuci' THEN 1
        WHEN 'kering' THEN 2
        WHEN 'addon_barang' THEN 3
    END,
    t.itemId`,
      [cabangId, idMitra, idMitra, cabangId]
    );

    if (rows.length === 0) {
      throw createHttpError(404, "Data setting harga tidak ditemukan untuk cabang ini", "BRANCH_PRICE_NOT_FOUND");
    }

    return rows;
};

module.exports = {
  createSettingHarga,
  getSettingHarga,
  getLogicalPriceKey,
  validatePriceItems,
};
