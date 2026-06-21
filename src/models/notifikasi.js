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

module.exports = {
  getNotifikasi,
};