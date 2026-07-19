const dbPool = require("../config/database");
const { createHttpError } = require("../utils/httpError");

const getNotifikasi = async (idMitra, cabangId, filterCabangId) => {
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
};

const markAsRead = async (id, idMitra, cabangId = null) => {
  // 1. Cek notifikasi dalam scope tenant; kasir hanya boleh mengubah cabangnya sendiri
  // atau notifikasi tenant-wide yang tidak terikat cabang.
  let scopeQuery = "SELECT id, isRead FROM tbl_notifikasi WHERE id = ? AND idMitra = ?";
  const scopeParams = [id, idMitra];

  if (cabangId) {
    scopeQuery += " AND (cabangId = ? OR cabangId IS NULL)";
    scopeParams.push(cabangId);
  }

  const [existing] = await dbPool.execute(scopeQuery, scopeParams);

  if (existing.length === 0) {
    throw createHttpError(404, "Id tidak ditemukan", "NOTIFICATION_NOT_FOUND");
  }

  // 2. Update isRead menjadi 1 (true)
  let updateQuery = "UPDATE tbl_notifikasi SET isRead = 1 WHERE id = ? AND idMitra = ?";
  const updateParams = [id, idMitra];

  if (cabangId) {
    updateQuery += " AND (cabangId = ? OR cabangId IS NULL)";
    updateParams.push(cabangId);
  }

  await dbPool.execute(updateQuery, updateParams);

  return {
    id: String(id),
    isRead: true,
  };
};

const markAllAsRead = async (idMitra, cabangId = null) => {
  let updateQuery = "UPDATE tbl_notifikasi SET isRead = 1 WHERE idMitra = ?";
  const updateParams = [idMitra];

  if (cabangId) {
    updateQuery += " AND (cabangId = ? OR cabangId IS NULL)";
    updateParams.push(cabangId);
  }

  const [result] = await dbPool.execute(updateQuery, updateParams);

  return {
    updatedCount: result.affectedRows || 0,
    isRead: true,
  };
};

module.exports = {
  getNotifikasi,
  markAsRead,
  markAllAsRead,
};
