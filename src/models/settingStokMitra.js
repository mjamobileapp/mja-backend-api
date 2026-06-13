const dbPool = require("../config/database");

const createNewSetting = async (body) => {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    const { idMitra, idItem, stokMinimum, createdBy } = body;

    // 1. Validasi Mitra Exist dan Aktif
    const [existingMitra] = await connection.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw new Error("Mitra tidak ditemukan atau tidak aktif");
    }

    // 2. Validasi Master Item Exist dan Aktif
    const [existingItem] = await connection.execute(
      "SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = TRUE",
      [idItem]
    );
    if (existingItem.length === 0) {
      throw new Error("Item tidak ditemukan atau tidak aktif");
    }

    // 3. Hapus data lama filter by idMitra (Sesuai Komentar PR #70)
    await connection.execute(
      "DELETE FROM tbl_setting_stok_mitra WHERE idMitra = ?",
      [idMitra]
    );

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    const SQLQuery = `INSERT INTO tbl_setting_stok_mitra (
      idMitra, idItem, stokMinimum, createdBy, createdDate
    ) VALUES (?, ?, ?, ?, ?)`;

    const values = [idMitra, idItem, stokMinimum, createdBy, dateNow];
    const [result] = await connection.execute(SQLQuery, values);

    await connection.commit();

    // Ambil data terbaru dengan JOIN untuk response
    const [insertedData] = await dbPool.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_setting_stok_mitra s
       JOIN tbl_mitra m ON s.idMitra = m.id
       JOIN tbl_master_item_expense i ON s.idItem = i.id
       WHERE s.id = ?`, [result.insertId]
    );

    return insertedData[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateSetting = async (id, body) => {
  try {
    const { stokMinimum, updatedBy } = body;

    const [existing] = await dbPool.execute(
      "SELECT id FROM tbl_setting_stok_mitra WHERE id = ?",
      [id]
    );
    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = `UPDATE tbl_setting_stok_mitra SET 
      stokMinimum = ?, updatedBy = ?, updatedDate = ? 
      WHERE id = ?`;

    await dbPool.execute(SQLQuery, [stokMinimum, updatedBy, updatedDate, id]);
    
    const [result] = await dbPool.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_setting_stok_mitra s
       JOIN tbl_mitra m ON s.idMitra = m.id
       JOIN tbl_master_item_expense i ON s.idItem = i.id
       WHERE s.id = ?`, [id]
    );
    return result[0];
  } catch (error) {
    throw error;
  }
};

const getAllSettings = async () => {
  try {
    let SQLQuery = `
      SELECT s.*, m.namaMitra, i.namaItem 
      FROM tbl_setting_stok_mitra s
      JOIN tbl_mitra m ON s.idMitra = m.id
      JOIN tbl_master_item_expense i ON s.idItem = i.id
    `;

    const [rows] = await dbPool.execute(SQLQuery);
    return rows;
  } catch (error) {
    throw error;
  }
};

const getSettingByIdMitra = async (idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_setting_stok_mitra s
       JOIN tbl_mitra m ON s.idMitra = m.id
       JOIN tbl_master_item_expense i ON s.idItem = i.id
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
  updateSetting,
  getAllSettings,
  getSettingByIdMitra
};