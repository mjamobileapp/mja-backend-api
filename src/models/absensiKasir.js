const dbPool = require("../config/database");

const getAbsensiKasir = (cabangId) => {
  const SQLQuery = `
    SELECT 
      a.id AS absensiId,
      u.namaLengkap AS namaKasir,
      DATE(a.waktuLogin) AS tanggalShift,
      DATE_FORMAT(a.waktuLogin, '%H:%i') AS jamMasuk,
      IF(a.waktuLogout IS NOT NULL, DATE_FORMAT(a.waktuLogout, '%H:%i'), 'Belum') AS jamPulang
    FROM tbl_absensi a
    JOIN tbl_users_mobile u ON a.idUserMobile = u.id
    WHERE a.cabangId = ?
    ORDER BY a.waktuLogin DESC
  `;
  return dbPool.execute(SQLQuery, [cabangId]);
};

module.exports = {
  getAbsensiKasir,
};
