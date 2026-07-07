const dbPool = require("../config/database");

const getNotifikasi = async (idMitra, cabangId, filterCabangId) => {
  try {
    let sqlQuery = `
      SELECT 
        id, cabangId, tipe, referenceId, judul, pesan, isRead, createdDate 
      FROM tbl_notifikasi 
      WHERE idMitra = ?
    `;
    let queryParams = [idMitra];

    if (cabangId) {
      sqlQuery += ` AND (cabangId = ? OR cabangId IS NULL)`;
      queryParams.push(cabangId);
    } else if (filterCabangId) {
      sqlQuery += ` AND cabangId = ?`;
      queryParams.push(filterCabangId);
    }

    sqlQuery += ` ORDER BY createdDate DESC LIMIT 50`;

    const [rows] = await dbPool.execute(sqlQuery, queryParams);
    return rows;
  } catch (error) {
    throw error;
  }
};

const markAsRead = async (id) => {
  try {
    // 1. Cek apakah notifikasi dengan id tersebut ada
    const [existing] = await dbPool.execute(
      "SELECT id, isRead FROM tbl_notifikasi WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      throw new Error("Id tidak ditemukan");
    }

    // 2. Update isRead menjadi 1 (true)
    await dbPool.execute(
      "UPDATE tbl_notifikasi SET isRead = 1 WHERE id = ?",
      [id]
    );

    return {
      id: String(id),
      isRead: true,
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getNotifikasi,
  markAsRead,
};