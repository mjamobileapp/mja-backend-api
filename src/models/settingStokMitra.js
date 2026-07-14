const dbPool = require("../config/database");
const { withTransaction } = require("../utils/transaction");
const { createHttpError } = require("../utils/httpError");

const createNewSetting = async (body) => {
  return withTransaction(async (connection) => {
    const { idMitra, itemId, batasMinimum, createdBy } = body;

    // 1. Validasi Mitra Exist dan Aktif
    const [existingMitra] = await connection.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw createHttpError(400, "Mitra tidak ditemukan atau tidak aktif", "STOCK_MITRA_INVALID");
    }

    // 2. Validasi Master Item Exist dan Aktif
    const [existingItem] = await connection.execute(
      "SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = TRUE AND tipeItem = 'stok'",
      [itemId]
    );
    if (existingItem.length === 0) {
      throw createHttpError(400, "Item tidak ditemukan atau tidak aktif", "STOCK_ITEM_INVALID");
    }

    // 3. Hapus data lama filter by idMitra (Sesuai Komentar PR #70)
    await connection.execute(
      "DELETE FROM tbl_treshold_stok_mitra WHERE idMitra = ?",
      [idMitra]
    );

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    const SQLQuery = `INSERT INTO tbl_treshold_stok_mitra (
      idMitra, itemId, batasMinimum, createdBy, createdDate
    ) VALUES (?, ?, ?, ?, ?)`;

    const values = [idMitra, itemId, batasMinimum, createdBy, dateNow];
    const [result] = await connection.execute(SQLQuery, values);

    // Ambil data response sebelum commit agar kegagalan read membatalkan write.
    const [insertedData] = await connection.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_treshold_stok_mitra s
       JOIN tbl_mitra m ON s.idMitra = m.id
       JOIN tbl_master_item_expense i ON s.itemId = i.id
       WHERE s.id = ?`, [result.insertId]
    );

    return insertedData[0];
  });
};

const createBulkSettings = async (idMitra, items, createdBy) => {
  return withTransaction(async (connection) => {

    // 1. Validasi Mitra Exist dan Aktif
    const [existingMitra] = await connection.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw createHttpError(400, "Mitra tidak ditemukan atau tidak aktif", "STOCK_MITRA_INVALID");
    }

    // 2. Hapus data lama filter by idMitra (Cukup sekali saja)
    await connection.execute(
      "DELETE FROM tbl_treshold_stok_mitra WHERE idMitra = ?",
      [idMitra]
    );

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    // 3. Insert data baru secara iteratif dalam satu transaksi yang sama
    for (const item of items) {
      const { itemId, batasMinimum } = item;

      // Validasi Master Item Exist dan Aktif
      const [existingItem] = await connection.execute(
        "SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = TRUE AND tipeItem = 'stok'",
        [itemId]
      );
      if (existingItem.length === 0) {
        throw createHttpError(400, "Item tidak ditemukan atau tidak aktif", "STOCK_ITEM_INVALID");
      }

      const SQLQuery = `INSERT INTO tbl_treshold_stok_mitra (
        idMitra, itemId, batasMinimum, createdBy, createdDate
      ) VALUES (?, ?, ?, ?, ?)`;

      const values = [idMitra, itemId, batasMinimum, createdBy, dateNow];
      await connection.execute(SQLQuery, values);
    }

    // Ambil data response sebelum commit agar kegagalan read membatalkan write.
    const [result] = await connection.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_treshold_stok_mitra s
       JOIN tbl_mitra m ON s.idMitra = m.id
       JOIN tbl_master_item_expense i ON s.itemId = i.id
       WHERE s.idMitra = ?`, [idMitra]
    );

    return result;
  });
};

const updateSetting = async (id, body) => {
  try {
    const { batasMinimum, updatedBy } = body;

    const [existing] = await dbPool.execute(
      "SELECT id FROM tbl_treshold_stok_mitra WHERE id = ?",
      [id]
    );
    if (existing.length === 0) throw createHttpError(404, "data not found", "STOCK_SETTING_NOT_FOUND");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = `UPDATE tbl_treshold_stok_mitra SET 
      batasMinimum = ?, updatedBy = ?, updatedDate = ? 
      WHERE id = ?`;

    await dbPool.execute(SQLQuery, [batasMinimum, updatedBy, updatedDate, id]);
    
    const [result] = await dbPool.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_treshold_stok_mitra s
       JOIN tbl_mitra m ON s.idMitra = m.id
       JOIN tbl_master_item_expense i ON s.itemId = i.id
       WHERE s.id = ?`, [id]
    );
    return result[0];
  } catch (error) {
    throw error;
  }
};

const getSettingById = async (id) => {
  try {
    const [rows] = await dbPool.execute(
      "SELECT * FROM tbl_treshold_stok_mitra WHERE id = ?",
      [id]
    );
    return rows[0];
  } catch (error) {
    throw error;
  }
};

const getAllSettings = async (idMitra) => {
  try {
    let SQLQuery = `
      select
        i.*,
        m.namaMitra,
        s.idMitra,
        coalesce(s.batasMinimum, 0) as batasMinimum
      from
        tbl_master_item_expense i
        left join tbl_treshold_stok_mitra s on
          s.itemId = i.id
          and s.idMitra = ?
        left join tbl_mitra m on
          s.idMitra = m.id
      where
        i.tipeItem = 'stok'
        and i.statusAktif = 1
    `;

    const [rows] = await dbPool.execute(SQLQuery, [idMitra]);
    return rows;
  } catch (error) {
    throw error;
  }
};

const getSettingByIdMitra = async (idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_treshold_stok_mitra s
       JOIN tbl_mitra m ON s.idMitra = m.id
       JOIN tbl_master_item_expense i ON s.itemId = i.id
       WHERE s.idMitra = ?`,
      [idMitra]
    );
    return rows;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createNewSetting,
  createBulkSettings,
  updateSetting,
  getAllSettings,
  getSettingByIdMitra,
  getSettingById
};
