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

const updateMitra = async (id) => {
  const [mitra] = await dbPool.execute("SELECT * FROM tbl_mitra WHERE id = ?", [
    id,
  ]);
  if (mitra.length === 0) {
    throw new Error("data not found");
  }

  const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
  await dbPool.execute("UPDATE tbl_mitra SET updatedDate = ? WHERE id = ?", [
    updatedDate,
    id,
  ]);

  const [updatedMitra] = await dbPool.execute(
    "SELECT * FROM tbl_mitra WHERE id = ?",
    [id]
  );
  return updatedMitra[0];
};

module.exports = {
  createNewMitra,
  updateMitra,
};
