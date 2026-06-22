const dbPool = require("../config/database");

const createSettingHarga = async (idMitra, cabangId, items, createdBy) => {
  try {
    // 1. Validasi idMitra
    const [mitraCheck] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
      [idMitra]
    );
    if (mitraCheck.length === 0) {
      throw new Error("Mitra tidak ditemukan");
    }

    // 2. Validasi cabangId
    const [cabangCheck] = await dbPool.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = 1",
      [cabangId, idMitra]
    );
    if (cabangCheck.length === 0) {
      throw new Error("Cabang tidak ditemukan");
    }

    // 3. DELETE data lama untuk idMitra & cabangId ini
    await dbPool.execute(
      "DELETE FROM tbl_harga_cabang WHERE idMitra = ? AND cabangId = ?",
      [idMitra, cabangId]
    );

    // 4. INSERT data baru untuk setiap item
    const insertedData = [];
    for (const item of items) {
      const { jenisLayanan, itemId, harga } = item;

      const [result] = await dbPool.execute(
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
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createSettingHarga,
};