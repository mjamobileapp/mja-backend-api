const dbPool = require("../config/database");

const createNewCabang = async (body) => {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Validasi Mitra Exist
    const { idMitra, namaCabang, alamatCabang, createdBy } = body;
    const [mitra] = await connection.execute("SELECT id FROM tbl_mitra WHERE id = ?", [idMitra]);
    if (mitra.length === 0) throw new Error("Mitra tidak ditemukan");

    // 2. Generate Kode Otomatis
    const prefix = `CBG-${idMitra}-`;
    const [rows] = await connection.execute(
      `SELECT kodeCabang FROM tbl_cabang 
       WHERE kodeCabang LIKE ? 
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [`${prefix}%`]
    );

    let urutan = 1;
    if (rows.length > 0) {
      const lastSequence = parseInt(rows[0].kodeCabang.split("-")[2], 10);
      urutan = lastSequence + 1;
    }
    const kodeCabang = `${prefix}${urutan.toString().padStart(4, "0")}`;

    // Check if cabang already exists
    const [existingCabang] = await connection.execute(
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

    await connection.execute(SQLQuery, values);
    await connection.commit();

    return { kodeCabang, ...body };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
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
