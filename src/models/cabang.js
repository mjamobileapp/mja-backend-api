const dbPool = require("../config/database");

const createNewCabang = async (body) => {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Validasi Mitra Exist
    const { idMitra, namaCabang, alamatCabang, createdBy } = body;
    const [mitra] = await connection.execute("SELECT id, namaMitra FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE", [idMitra]);
    if (mitra.length === 0) throw new Error("Mitra tidak ditemukan atau tidak aktif");

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
      statusAktif,
      createdBy,
      createdDate
     )
      VALUES (?,?,?,?,?,?,?)`;

    const values = [idMitra, kodeCabang, namaCabang, alamatCabang, true, createdBy, dateNow];

    await connection.execute(SQLQuery, values);
    await connection.commit();

    return { kodeCabang, ...body, namaMitra: mitra[0].namaMitra, statusAktif: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateCabang = async (id, body) => {
  try {
    const {namaCabang, alamatCabang, updatedBy } = body;

    // Check if cabang exists
    const [existingCabang] = await dbPool.execute(
      "SELECT kodeCabang FROM tbl_cabang WHERE id = ? AND statusAktif = 1",
      [id]
    );
    if (existingCabang.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Update the cabang data - only update available fields
    const SQLQuery = `UPDATE tbl_cabang SET
      namaCabang = ?,
      alamatCabang = ?,
      updatedBy = ?,  
      updatedDate = ?    
      WHERE id = ?`;

    const values = [namaCabang, alamatCabang, updatedBy, updatedDate, id];

    await dbPool.execute(SQLQuery, values);

    // Fetch and return the updated cabang data
    const [updatedCabang] = await dbPool.execute(
      `SELECT c.*, m.namaMitra 
       FROM tbl_cabang c
       JOIN tbl_mitra m ON c.idMitra = m.id
       WHERE c.id = ?`,
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

const deleteCabang = async (id, updatedBy) => {
  try {
    // Check if cabang exists
    const [existingCabang] = await dbPool.execute(
      "SELECT kodeCabang FROM tbl_cabang WHERE id = ? AND statusAktif = 1",
      [id]
    );
    if (existingCabang.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Execute UPDATE query for soft delete
    const SQLQuery = "UPDATE tbl_cabang SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    const result = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);

    return result;
  } catch (error) {
    throw error;
  }
};

const getCabangById = async (id) => {
  try {
    const [cabang] = await dbPool.execute(
      `SELECT c.*, m.namaMitra 
       FROM tbl_cabang c
       JOIN tbl_mitra m ON c.idMitra = m.id
       WHERE c.id = ?`,
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

const getAllCabang = async (status) => {
  try {
    let SQLQuery = `
      SELECT c.*, m.namaMitra 
      FROM tbl_cabang c
      JOIN tbl_mitra m ON c.idMitra = m.id`;

    if (status === "all") {
      // Ambil semua data tanpa filter
    } else if (status === "inactive") {
      // Ambil hanya yang nonaktif
      SQLQuery += " WHERE c.statusAktif = 0";
    } else {
      // Default: Ambil hanya yang aktif
      SQLQuery += " WHERE c.statusAktif = 1";
    }

    const [cabangs] = await dbPool.execute(SQLQuery);
    return cabangs;
  } catch (error) {
    throw error;
  }
};

const getCabangByIdMitra = async (idMitra) => {
  try {
    const [cabangs] = await dbPool.execute(
      `SELECT c.*, m.namaMitra 
       FROM tbl_cabang c
       JOIN tbl_mitra m ON c.idMitra = m.id
       WHERE c.idMitra = ? AND c.statusAktif = 1`,
      [idMitra]
    );
    return cabangs;
  } catch (error) {
    throw error;
  }
};

const restoreCabang = async (id, updatedBy) => {
  try {
    // Check if cabang exists and is currently inactive
    const [existingCabang] = await dbPool.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND statusAktif = 0",
      [id]
    );
    if (existingCabang.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Execute UPDATE query to set statusAktif back to 1 (true)
    const SQLQuery = "UPDATE tbl_cabang SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    const result = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);

    return result;
  } catch (error) {
    throw error;
  }
};

const resetCabang = async (id) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingCabang] = await connection.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND statusAktif = 1",
      [id]
    );

    if (existingCabang.length === 0) {
      throw new Error("data not found");
    }

    await connection.execute(
      `DELETE d FROM tbl_detail_order d
       JOIN tbl_order_laundry o ON d.orderId = o.id
       WHERE o.cabangId = ?`,
      [id]
    );

    await connection.execute("DELETE FROM tbl_stok_cabang WHERE cabangId = ?", [id]);
    await connection.execute("DELETE FROM tbl_log_mesin WHERE cabangId = ?", [id]);
    await connection.execute("DELETE FROM tbl_order_laundry WHERE cabangId = ?", [id]);
    await connection.execute("DELETE FROM tbl_pengeluaran WHERE cabangId = ?", [id]);
    await connection.execute("DELETE FROM tbl_absensi WHERE cabangId = ?", [id]);
    await connection.execute("DELETE FROM tbl_notifikasi WHERE cabangId = ?", [id]);

    await connection.commit();

    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  createNewCabang,
  updateCabang,
  deleteCabang,
  restoreCabang,
  resetCabang,
  getCabangById,
  getAllCabang,
  getCabangByIdMitra
};
