const dbPool = require("../config/database");

const createNewSetting = async (body) => {
  try {
    const { idMitra, idItem, stokMinimum, createdBy } = body;

    // 1. Validasi Mitra Exist dan Aktif
    const [existingMitra] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw new Error("Mitra tidak ditemukan atau tidak aktif");
    }

    // 2. Validasi Master Item Exist dan Aktif
    const [existingItem] = await dbPool.execute(
      "SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = TRUE",
      [idItem]
    );
    if (existingItem.length === 0) {
      throw new Error("Item tidak ditemukan atau tidak aktif");
    }

    // 3. Validasi Duplikasi (Mitra + Item)
    const [duplicate] = await dbPool.execute(
      "SELECT id FROM tbl_setting_stok_mitra WHERE idMitra = ? AND idItem = ? AND statusAktif = TRUE",
      [idMitra, idItem]
    );
    if (duplicate.length > 0) {
      throw new Error("Setting stok untuk item ini sudah ada pada mitra tersebut");
    }

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    const SQLQuery = `INSERT INTO tbl_setting_stok_mitra (
      idMitra, idItem, stokMinimum, createdBy, createdDate, statusAktif
    ) VALUES (?, ?, ?, ?, ?, ?)`;

    const values = [idMitra, idItem, stokMinimum, createdBy, dateNow, true];
    const [result] = await dbPool.execute(SQLQuery, values);

    return { id: result.insertId, ...body, statusAktif: true };
  } catch (error) {
    throw error;
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

const getAllSettings = async (status) => {
  try {
    let SQLQuery = `
      SELECT s.*, m.namaMitra, i.namaItem 
      FROM tbl_setting_stok_mitra s
      JOIN tbl_mitra m ON s.idMitra = m.id
      JOIN tbl_master_item_expense i ON s.idItem = i.id
    `;

    if (status === "inactive") {
      SQLQuery += " WHERE s.statusAktif = 0";
    } else if (status !== "all") {
      SQLQuery += " WHERE s.statusAktif = 1";
    }

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
       WHERE s.idMitra = ? AND s.statusAktif = 1`,
      [idMitra]
    );
    return rows;
  } catch (error) {
    throw error;
  }
};

const deleteSetting = async (id, updatedBy) => {
  try {
    const [existing] = await dbPool.execute(
      "SELECT id FROM tbl_setting_stok_mitra WHERE id = ? AND statusAktif = 1",
      [id]
    );
    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_setting_stok_mitra SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    return await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

const restoreSetting = async (id, updatedBy) => {
  try {
    const [existing] = await dbPool.execute(
      "SELECT id FROM tbl_setting_stok_mitra WHERE id = ? AND statusAktif = 0",
      [id]
    );
    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_setting_stok_mitra SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    return await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createNewSetting,
  updateSetting,
  getAllSettings,
  getSettingByIdMitra,
  deleteSetting,
  restoreSetting
};