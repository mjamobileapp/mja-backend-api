const dbPool = require("../config/database");

const getMitra = async () => {
  try {
    const [rows] = await dbPool.execute(
      "SELECT * FROM tbl_mitra WHERE statusAktif = 1 ORDER BY createdDate DESC"
    );
    return rows;
  } catch (error) {
    console.error("Dashboard Model Error (getMitra):", error.message);
    throw error;
  }
};

const getCabang = async () => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT c.*, m.namaMitra 
       FROM tbl_cabang c
       JOIN tbl_mitra m ON c.idMitra = m.id
       WHERE c.statusAktif = 1 
       ORDER BY c.createdDate DESC`
    );
    return rows;
  } catch (error) {
    console.error("Dashboard Model Error (getCabang):", error.message);
    throw error;
  }
};

const getMesin = async () => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT m.*, mitra.namaMitra, cabang.namaCabang 
       FROM tbl_mesin m 
       LEFT JOIN tbl_mitra mitra ON m.idMitra = mitra.id 
       LEFT JOIN tbl_cabang cabang ON m.cabangId = cabang.id 
       WHERE m.statusAktif = 1 
       ORDER BY m.createdDate DESC`
    );
    return rows;
  } catch (error) {
    console.error("Dashboard Model Error (getMesin):", error.message);
    throw error;
  }
};

module.exports = { getMitra, getCabang, getMesin };