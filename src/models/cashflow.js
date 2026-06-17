const dbPool = require("../config/database");

const getCashflow = (cabangId, idMitra) => {
  const SQLQuery = `
    SELECT 
      IFNULL(SUM(DISTINCT o.totalBayar), 0) AS totalPemasukan,
      IFNULL(SUM(p.nominal), 0) AS totalPengeluaran,
      IFNULL(SUM(DISTINCT o.totalBayar), 0) - IFNULL(SUM(p.nominal), 0) AS sisaKas
    FROM tbl_order_laundry o
    LEFT JOIN tbl_pengeluaran p 
      ON p.cabangId = o.cabangId 
      AND p.idMitra = ?
      AND DATE(p.waktuPengeluaran) = CURDATE()
    WHERE o.cabangId = ?
      AND DATE(o.waktuOrder) = CURDATE()
    GROUP BY o.cabangId;
  `;
  return dbPool.execute(SQLQuery, [idMitra, cabangId]);
};

module.exports = {
  getCashflow,
};