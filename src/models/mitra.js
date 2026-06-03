const dbPool = require("../config/database");
const bcrypt = require("bcrypt");

const createNewMitra = async (body) => {
  try {
    const { kodeMitra, namaMitra, createdBy } = body;

    // Check if mitra already exists
    const [existingMitra] = await dbPool.execute(
      "SELECT * FROM tbl_mitra WHERE kodeMitra = ?",
      [kodeMitra]
    );

    if (existingMitra.length > 0) {
      throw new Error("Mitra sudah terdaftar");
    }

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    const SQLQuery = `INSERT INTO tbl_mitra (
      kodeMitra,
      namaMitra,
      createdBy,
      createdDate
     )
      VALUES (?,?,?,?)`;

    const values = [kodeMitra, namaMitra, createdBy, dateNow];

    return await dbPool.execute(SQLQuery, values);
  } catch (error) {
    throw error;
  }
};

const updateMitra = async (id, body) => {
  try {
    const { kodeMitra, namaMitra, updatedBy } = body;

    // Check if mitra exists
    const [existingMitra] = await dbPool.execute(
      "SELECT * FROM tbl_mitra WHERE id = ?",
      [id]
    );
    if (existingMitra.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Update the mitra data - only update available fields
    const SQLQuery = `UPDATE tbl_mitra SET
      kodeMitra = ?,
      namaMitra = ?
      WHERE id = ?`;

    const values = [kodeMitra, namaMitra, id];

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
      "SELECT * FROM tbl_mitra WHERE id = ?",
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

module.exports = {
  createNewMitra,
  updateMitra,
  deleteMitra,
};
