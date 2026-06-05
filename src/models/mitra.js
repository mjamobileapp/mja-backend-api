const dbPool = require("../config/database");
const { getTodayStringYYYYMMDD } = require("../utils/date");

const createNewMitra = async (body) => {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Generate Kode Otomatis
    const todayStr = getTodayStringYYYYMMDD();
    const prefix = `MTR-${todayStr}-`;

    const [rows] = await connection.execute(
      `SELECT kodeMitra FROM tbl_mitra 
       WHERE kodeMitra LIKE ? 
       ORDER BY kodeMitra DESC LIMIT 1 FOR UPDATE`,
      [`${prefix}%`]
    );

    let urutan = 1;
    if (rows.length > 0) {
      const lastSequence = parseInt(rows[0].kodeMitra.split("-")[2], 10);
      urutan = lastSequence + 1;
    }
    const kodeMitra = `${prefix}${urutan.toString().padStart(4, "0")}`;

    const { namaMitra, alamatMitra, createdBy } = body;

    // Check if mitra already exists
    const [existingMitra] = await connection.execute(
      "SELECT id FROM tbl_mitra WHERE kodeMitra = ?",
      [kodeMitra]
    );

    if (existingMitra.length > 0) {
      throw new Error("Mitra sudah terdaftar");
    }

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    const SQLQuery = `INSERT INTO tbl_mitra (
      kodeMitra,
      namaMitra,
      alamatMitra,
      createdBy,
      createdDate,
      statusAktif
     )
      VALUES (?,?,?,?,?,?)`;

    const values = [kodeMitra, namaMitra, alamatMitra, createdBy, dateNow, true];

    await connection.execute(SQLQuery, values);
    await connection.commit();

    return { kodeMitra, ...body, statusAktif: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateMitra = async (id, body) => {
  try {
    const { namaMitra, alamatMitra, updatedBy } = body;

    // Check if mitra exists
    const [existingMitra] = await dbPool.execute(
      "SELECT kodeMitra FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
      [id]
    );
    if (existingMitra.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Update the mitra data - only update available fields
    const SQLQuery = `UPDATE tbl_mitra SET
      namaMitra = ?,
      alamatMitra = ?,
      updatedBy = ?,  
      updatedDate = ?    
      WHERE id = ?`;

    const values = [namaMitra, alamatMitra, updatedBy, updatedDate, id];

    await dbPool.execute(SQLQuery, values);

    // Fetch and return the updated mitra data
    const [updatedMitra] = await dbPool.execute(
      "SELECT * FROM tbl_mitra WHERE id = ?",
      [id]
    );

    // Add updatedBy and updatedDate to response if updating
    const result = updatedMitra[0];
    result.updatedBy = updatedBy;
    result.updatedDate = updatedDate;

    return result;
  } catch (error) {
    throw error;
  }
};

const deleteMitra = async (id, updatedBy) => {
  try {
    // Check if mitra exists
    const [existingMitra] = await dbPool.execute(
      "SELECT kodeMitra FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
      [id]
    );
    if (existingMitra.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Execute UPDATE query for soft delete
    const SQLQuery = "UPDATE tbl_mitra SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    const result = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);

    return result;
  } catch (error) {
    throw error;
  }
};

const getMitraById = async (id) => {
  try {
    const [mitra] = await dbPool.execute(
      "SELECT * FROM tbl_mitra WHERE id = ?",
      [id]
    );
    if (mitra.length === 0) {
      throw new Error("data not found");
    }
    return mitra[0];
  } catch (error) {
    throw error;
  }
};

const getAllMitra = async (status) => {
  try {
    let SQLQuery = "SELECT * FROM tbl_mitra";

    if (status === "all") {
      // Ambil semua data tanpa filter statusAktif
    } else if (status === "inactive") {
      // Ambil hanya yang nonaktif (statusAktif = 0)
      SQLQuery += " WHERE statusAktif = 0";
    } else {
      // Default: Ambil hanya yang aktif (statusAktif = 1)
      SQLQuery += " WHERE statusAktif = 1";
    }

    const [mitras] = await dbPool.execute(SQLQuery);
    return mitras;
  } catch (error) {
    throw error;
  }
};

const restoreMitra = async (id, updatedBy) => {
  try {
    // Check if mitra exists and is currently inactive (statusAktif = 0)
    const [existingMitra] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 0",
      [id]
    );
    if (existingMitra.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Execute UPDATE query to set statusAktif back to 1 (true)
    const SQLQuery = "UPDATE tbl_mitra SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    const result = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);

    return result;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createNewMitra,
  updateMitra,
  deleteMitra,
  restoreMitra,
  getMitraById,
  getAllMitra,
};
