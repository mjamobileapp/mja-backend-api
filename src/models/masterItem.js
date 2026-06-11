const dbPool = require("../config/database");

const createNewMasterItem = async (body) => {
  try {
    const { namaItem, tipeItem, createdBy } = body;

    // 1. Validasi Duplikasi berdasarkan namaItem
    const [existingItem] = await dbPool.execute(
      "SELECT id FROM tbl_master_item_expense WHERE namaItem = ?",
      [namaItem]
    );

    if (existingItem.length > 0) {
      throw new Error("Master Item sudah terdaftar");
    }

    // 2. Persiapkan timestamp saat ini
    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    // 3. Query INSERT data baru
    const SQLQuery = `INSERT INTO tbl_master_item_expense (
      namaItem,
      tipeItem,
      createdBy,
      createdDate,
      statusAktif
    ) VALUES (?, ?, ?, ?, ?)`;

    const values = [namaItem, tipeItem, createdBy, dateNow, true];

    await dbPool.execute(SQLQuery, values);

    // 4. Return data sesuai spesifikasi response
    return { namaItem, tipeItem, createdBy, statusAktif: true };
  } catch (error) {
    throw error;
  }
};

const getAllMasterItem = async (status) => {
  try {
    let SQLQuery = "SELECT * FROM tbl_master_item_expense";

    if (status === "all") {
      // Ambil semua data
    } else if (status === "inactive") {
      SQLQuery += " WHERE statusAktif = 0";
    } else {
      // Default: Aktif
      SQLQuery += " WHERE statusAktif = 1";
    }

    const [items] = await dbPool.execute(SQLQuery);
    return items;
  } catch (error) {
    throw error;
  }
};

const getMasterItemById = async (id) => {
  try {
    const [item] = await dbPool.execute("SELECT * FROM tbl_master_item_expense WHERE id = ?", [id]);
    if (item.length === 0) throw new Error("data not found");
    return item[0];
  } catch (error) {
    throw error;
  }
};

const getMasterItemByTipe = async (tipeItem) => {
  try {
    const [items] = await dbPool.execute(
      "SELECT * FROM tbl_master_item_expense WHERE tipeItem = ? AND statusAktif = 1",
      [tipeItem]
    );

    if (items.length === 0) throw new Error("data not found");
    return items;
  } catch (error) {
    throw error;
  }
};

const deleteMasterItem = async (id, updatedBy) => {
  try {
    const [existing] = await dbPool.execute("SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = 1", [id]);
    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_master_item_expense SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    return await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

const updateMasterItem = async (id, body) => {
  try {
    const { namaItem, tipeItem, updatedBy } = body;

    // 1. Cek apakah item ada dan aktif
    const [existingItem] = await dbPool.execute(
      "SELECT namaItem FROM tbl_master_item_expense WHERE id = ? AND statusAktif = 1",
      [id]
    );
    if (existingItem.length === 0) {
      throw new Error("data not found");
    }

    // 2. Validasi duplikasi jika namaItem diubah
    if (namaItem !== existingItem[0].namaItem) {
      const [duplicate] = await dbPool.execute(
        "SELECT id FROM tbl_master_item_expense WHERE namaItem = ? AND id != ?",
        [namaItem, id]
      );
      if (duplicate.length > 0) {
        throw new Error("Master Item sudah terdaftar");
      }
    }

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_master_item_expense SET namaItem = ?, tipeItem = ?, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    await dbPool.execute(SQLQuery, [namaItem, tipeItem, updatedBy, updatedDate, id]);

    const [result] = await dbPool.execute("SELECT * FROM tbl_master_item_expense WHERE id = ?", [id]);
    return result[0];
  } catch (error) {
    throw error;
  }
};

const restoreMasterItem = async (id, updatedBy) => {
  try {
    const [existing] = await dbPool.execute("SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = 0", [id]);
    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_master_item_expense SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    return await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createNewMasterItem,
  getAllMasterItem,
  getMasterItemById,
  getMasterItemByTipe,
  updateMasterItem,
  deleteMasterItem,
  restoreMasterItem,
};