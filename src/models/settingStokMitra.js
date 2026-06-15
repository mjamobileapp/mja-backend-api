const dbPool = require("../config/database");

const createNewSetting = async (body) => {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    const { idMitra, idItem, batasMinimum, createdBy } = body;

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
      "SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = TRUE AND tipeItem = 'stok'",
      [idItem]
    );
    if (existingItem.length === 0) {
      throw new Error("Item tidak ditemukan atau tidak aktif");
    }

    // 3. Hapus data lama filter by idMitra (Sesuai Komentar PR #70)
    await connection.execute(
      "DELETE FROM tbl_treshold_stok_mitra WHERE idMitra = ?",
      [idMitra]
    );

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    const SQLQuery = `INSERT INTO tbl_treshold_stok_mitra (
      idMitra, idItem, batasMinimum, createdBy, createdDate
    ) VALUES (?, ?, ?, ?, ?)`;

    const values = [idMitra, idItem, batasMinimum, createdBy, dateNow];
    const [result] = await connection.execute(SQLQuery, values);

    await connection.commit();

    // Ambil data terbaru dengan JOIN untuk response
    const [insertedData] = await dbPool.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_treshold_stok_mitra s
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

const createBulkSettings = async (idMitra, items, createdBy) => {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Validasi Mitra Exist dan Aktif
    const [existingMitra] = await connection.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw new Error("Mitra tidak ditemukan atau tidak aktif");
    }

    // 2. Hapus data lama filter by idMitra (Cukup sekali saja)
    await connection.execute(
      "DELETE FROM tbl_treshold_stok_mitra WHERE idMitra = ?",
      [idMitra]
    );

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    // 3. Insert data baru secara iteratif dalam satu transaksi yang sama
    for (const item of items) {
      const { idItem, batasMinimum } = item;

      // Validasi Master Item Exist dan Aktif
      const [existingItem] = await connection.execute(
        "SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = TRUE AND tipeItem = 'stok'",
        [idItem]
      );
      if (existingItem.length === 0) {
        throw new Error("Item tidak ditemukan atau tidak aktif");
      }

      const SQLQuery = `INSERT INTO tbl_treshold_stok_mitra (
        idMitra, idItem, batasMinimum, createdBy, createdDate
      ) VALUES (?, ?, ?, ?, ?)`;

      const values = [idMitra, idItem, batasMinimum, createdBy, dateNow];
      await connection.execute(SQLQuery, values);
    }

    await connection.commit();

    // Ambil semua data terbaru milik Mitra ini untuk response
    const [result] = await dbPool.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_treshold_stok_mitra s
       JOIN tbl_mitra m ON s.idMitra = m.id
       JOIN tbl_master_item_expense i ON s.idItem = i.id
       WHERE s.idMitra = ?`, [idMitra]
    );

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateSetting = async (id, body) => {
  try {
    const { batasMinimum, updatedBy } = body;

    const [existing] = await dbPool.execute(
      "SELECT id FROM tbl_treshold_stok_mitra WHERE id = ?",
      [id]
    );
    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = `UPDATE tbl_treshold_stok_mitra SET 
      batasMinimum = ?, updatedBy = ?, updatedDate = ? 
      WHERE id = ?`;

    await dbPool.execute(SQLQuery, [batasMinimum, updatedBy, updatedDate, id]);
    
    const [result] = await dbPool.execute(
      `SELECT s.*, m.namaMitra, i.namaItem 
       FROM tbl_treshold_stok_mitra s
       JOIN tbl_mitra m ON s.idMitra = m.id
       JOIN tbl_master_item_expense i ON s.idItem = i.id
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
          s.idItem = i.id
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
  createBulkSettings,
  updateSetting,
  getAllSettings,
  getSettingByIdMitra,
  getSettingById
};