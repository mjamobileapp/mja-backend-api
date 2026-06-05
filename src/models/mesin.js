const dbPool = require("../config/database");

const createNewMesin = async (body) => {
  try {
    const { idMitra, cabangId, namaMesin, tipeMesin, kapasitas, ipAddressEsp, macAddress, status, createdBy } = body;

    // 1. Validasi Mitra Exist
    const [existingMitra] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw new Error("Mitra tidak ditemukan atau tidak aktif");
    }

    // 2. Validasi Cabang Exist dan sesuai dengan Mitra
    const [existingCabang] = await dbPool.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = TRUE",
      [cabangId, idMitra]
    );
    if (existingCabang.length === 0) {
      throw new Error("Cabang tidak ditemukan / tidak aktif / tidak sesuai dengan Mitra");
    }

    // Check if mesin already exists
    const [existingMesin] = await dbPool.execute(
      "SELECT id FROM tbl_mesin WHERE ipAddressEsp = ? AND statusAktif = TRUE",
      [ipAddressEsp]
    );

    if (existingMesin.length > 0) {
      throw new Error("Mesin dengan IP Address yang sama sudah terdaftar");
    }

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    const SQLQuery = `INSERT INTO tbl_mesin (
      idMitra,
      cabangId,
      namaMesin,
      tipeMesin,
      kapasitas,
      ipAddressEsp,
      macAddress,
      status,
      createdBy,
      createdDate,
      statusAktif
     )
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`;

    const values = [idMitra, cabangId, namaMesin, tipeMesin, kapasitas, ipAddressEsp, macAddress, status, createdBy, dateNow, true];

    const [result] = await dbPool.execute(SQLQuery, values);
    
    return { id: result.insertId, ...body, statusAktif: true };
  } catch (error) {
    throw error;
  }
};

const updateMesin = async (id, body) => {
  try {
    const { namaMesin, tipeMesin, kapasitas, ipAddressEsp, macAddress, updatedBy } = body;

    // Check if mesin exists
    const [existingMesin] = await dbPool.execute(
      "SELECT namaMesin FROM tbl_mesin WHERE id = ?",
      [id]
    );
    if (existingMesin.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Update the mesin data - only update available fields
    const SQLQuery = `UPDATE tbl_mesin SET
      namaMesin = ?,
      tipeMesin = ?,
      kapasitas = ?,
      ipAddressEsp = ?,
      macAddress = ?,
      updatedBy = ?,  
      updatedDate = ?    
      WHERE id = ?`;

    const values = [namaMesin, tipeMesin, kapasitas, ipAddressEsp, macAddress, updatedBy, updatedDate, id];

    await dbPool.execute(SQLQuery, values);

    // Fetch and return the updated mesin data
    const [updatedMesin] = await dbPool.execute(
      "SELECT * FROM tbl_mesin WHERE id = ?",
      [id]
    );

    const result = updatedMesin[0];
    return result;
  } catch (error) {
    throw error;
  }
};

const deleteMesin = async (id, updatedBy) => {
  try {
    // 1. Cek apakah mesin eksis dan aktif
    const [existingMesin] = await dbPool.execute(
      "SELECT id, status FROM tbl_mesin WHERE id = ? AND statusAktif = 1",
      [id]
    );
    
    if (existingMesin.length === 0) {
      throw new Error("data not found");
    }

    // 2. Tolak jika mesin sedang menyala (status = in_use)
    if (existingMesin[0].status === "in_use") {
      throw new Error("Mesin sedang menyala");
    }

    // 3. Soft delete: update statusAktif menjadi 0 dan update updatedBy
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_mesin SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    const [result] = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);

    return result;
  } catch (error) {
    throw error;
  }
};

const getMesinById = async (id) => {
  try {
    const [mesin] = await dbPool.execute(
      "SELECT * FROM tbl_mesin WHERE id = ?",
      [id]
    );
    if (mesin.length === 0) {
      throw new Error("data not found");
    }
    return mesin[0];
  } catch (error) {
    throw error;
  }
};

const getAllMesin = async () => {
  try {
    const [mesins] = await dbPool.execute(
      "SELECT * FROM tbl_mesin"
    );
    return mesins;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createNewMesin,
  updateMesin,
  deleteMesin,
  getMesinById,
  getAllMesin,
};
