const dbPool = require("../config/database");

const getLastMitraCode = async (prefix) => {
  const [rows] = await dbPool.execute(
    `SELECT kodeMitra FROM tbl_mitra 
     WHERE kodeMitra LIKE ? 
     ORDER BY kodeMitra DESC LIMIT 1`,
    [`${prefix}%`]
  );
  return rows;
};

const createNewMitra = async (body) => {
  try {
    const { kodeMitra, namaMitra, alamatMitra, createdBy } = body;

    // Check if mitra already exists
    const [existingMitra] = await dbPool.execute(
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
      createdDate
     )
      VALUES (?,?,?,?,?)`;

    const values = [kodeMitra, namaMitra, alamatMitra, createdBy, dateNow];

    return await dbPool.execute(SQLQuery, values);
  } catch (error) {
    throw error;
  }
};

const updateMitra = async (id, body) => {
  try {
    const { namaMitra, alamatMitra, updatedBy } = body;

    // Check if mitra exists
    const [existingMitra] = await dbPool.execute(
      "SELECT kodeMitra FROM tbl_mitra WHERE id = ?",
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

const deleteMitra = async (id) => {
  try {
    // Check if mitra exists
    const [existingMitra] = await dbPool.execute(
      "SELECT kodeMitra FROM tbl_mitra WHERE id = ?",
      [id]
    );
    if (existingMitra.length === 0) {
      throw new Error("data not found");
    }

    // Execute DELETE query
    const SQLQuery = "DELETE FROM tbl_mitra WHERE id = ?";
    const result = await dbPool.execute(SQLQuery, [id]);

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

const getAllMitra = async () => {
  try {
    const [mitras] = await dbPool.execute(
      "SELECT * FROM tbl_mitra"
    );
    return mitras;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getLastMitraCode,
  createNewMitra,
  updateMitra,
  deleteMitra,
  getMitraById,
  getAllMitra,
};
