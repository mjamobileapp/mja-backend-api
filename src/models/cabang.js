const dbPool = require("../config/database");
const bcrypt = require("bcrypt");

const createNewCabang = async (body) => {
  try {
    const { idMitra, kodeCabang, namaCabang, alamatCabang, createdBy } = body;

    // Check if cabang already exists
    const [existingCabang] = await dbPool.execute(
      "SELECT id FROM tbl_cabang WHERE kodeCabang = ?",
      [kodeCabang]
    );

    if (existingCabang.length > 0) {
      throw new Error("Cabang sudah terdaftar");
    }

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    const SQLQuery = `INSERT INTO tbl_cabang (
      idMitra,
      kodeCabang,
      namaCabang,
      alamatCabang,
      createdBy,
      createdDate
     )
      VALUES (?,?,?,?,?,?)`;

    const values = [idMitra, kodeCabang, namaCabang, alamatCabang, createdBy, dateNow];

    return await dbPool.execute(SQLQuery, values);
  } catch (error) {
    throw error;
  }
};

const updateCabang = async (id, body) => {
  try {
    const { idMitra, kodeCabang, namaCabang, alamatCabang, updatedBy } = body;

    // Check if cabang exists
    const [existingCabang] = await dbPool.execute(
      "SELECT kodeCabang FROM tbl_cabang WHERE id = ?",
      [id]
    );
    if (existingCabang.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Update the cabang data - only update available fields
    const SQLQuery = `UPDATE tbl_cabang SET
      idMitra = ?,
      kodeCabang = ?,
      namaCabang = ?,
      alamatCabang = ?,
      updatedBy = ?,  
      updatedDate = ?    
      WHERE id = ?`;

    const values = [idMitra, kodeCabang, namaCabang, alamatCabang, updatedBy, updatedDate, id];

    await dbPool.execute(SQLQuery, values);

    // Fetch and return the updated cabang data
    const [updatedCabang] = await dbPool.execute(
      "SELECT * FROM tbl_cabang WHERE id = ?",
      [id]
    );

    // Add updatedBy and updatedDate to response if updating
    const result = updatedCabang[0];
    result.updatedBy = updatedBy;
    result.updatedDate = updatedDate;

    return result;
  } catch (error) {
    throw error;
  }
};

const deleteCabang = async (id) => {
  try {
    // Check if cabang exists
    const [existingCabang] = await dbPool.execute(
      "SELECT kodeCabang FROM tbl_cabang WHERE id = ?",
      [id]
    );
    if (existingCabang.length === 0) {
      throw new Error("data not found");
    }

    // Execute DELETE query
    const SQLQuery = "DELETE FROM tbl_cabang WHERE id = ?";
    const result = await dbPool.execute(SQLQuery, [id]);

    return result;
  } catch (error) {
    throw error;
  }
};

const getCabangById = async (id) => {
  try {
    const [cabang] = await dbPool.execute(
      "SELECT * FROM tbl_cabang WHERE id = ?",
      [id]
    );
    if (cabang.length === 0) {
      throw new Error("data not found");
    }
    return cabang[0];
  } catch (error) {
    throw error;
  }
};

const getAllCabang = async () => {
  try {
    const [cabangs] = await dbPool.execute(
      "SELECT * FROM tbl_cabang"
    );
    return cabangs;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createNewCabang,
  updateCabang,
  deleteCabang,
  getCabangById,
  getAllCabang
};
