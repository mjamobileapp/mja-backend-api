const dbPool = require("../config/database");

const getCashflow = (cabangId, idMitra, cabangId2, idMitra2) => {
  const SQLQuery = `
    SELECT 
  pemasukan.total AS totalPemasukan,
  pengeluaran.total AS totalPengeluaran,
  (pemasukan.total - pengeluaran.total) AS sisaKas
FROM 
  -- 1. Ruangan Pemasukan
  (SELECT IFNULL(SUM(totalBayar), 0) AS total 
   FROM tbl_order_laundry 
   WHERE cabangId = ? AND idMitra = ?
     AND DATE(waktuOrder) = CURDATE()
  ) AS pemasukan
  
CROSS JOIN 
  
  -- 2. Ruangan Pengeluaran
  (SELECT IFNULL(SUM(nominal), 0) AS total 
   FROM tbl_pengeluaran 
   WHERE cabangId = ? AND idMitra = ?
     AND DATE(waktuPengeluaran) = CURDATE()
  ) AS pengeluaran
  `;
  return dbPool.execute(SQLQuery, [cabangId, idMitra, cabangId2, idMitra2]);
};

module.exports = {
  getCashflow,
};