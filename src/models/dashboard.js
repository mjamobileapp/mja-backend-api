const dbPool = require("../config/database");

const getMitra = async () => {
  const [rows] = await dbPool.execute(
    "SELECT * FROM tbl_mitra WHERE statusAktif = 1 ORDER BY createdDate DESC"
  );
  return rows;
};

const getCabang = async () => {
  const [rows] = await dbPool.execute(
    `SELECT c.*, m.namaMitra
     FROM tbl_cabang c
     JOIN tbl_mitra m ON c.idMitra = m.id
     WHERE c.statusAktif = 1
     ORDER BY c.createdDate DESC`
  );
  return rows;
};

const getMesin = async () => {
  // Query menghitung total master yang aktif, dan menghitung washer/dryer dari detail
  const [rows] = await dbPool.execute(
    `SELECT
      COUNT(DISTINCT d.id) AS total,
      SUM(CASE WHEN d.jenisMesin = 'WASHER' THEN 1 ELSE 0 END) AS totalWasher,
      SUM(CASE WHEN d.jenisMesin = 'DRYER' THEN 1 ELSE 0 END) AS totalDryer
     FROM tbl_mesin_master m
     LEFT JOIN tbl_mesin_detail d ON d.idMesinMaster = m.id
     WHERE m.statusAktif = 1`
  );

  if (rows.length === 0) {
    return { total: 0, totalWasher: 0, totalDryer: 0 };
  }

  return {
    total: Number(rows[0].total),
    totalWasher: Number(rows[0].totalWasher),
    totalDryer: Number(rows[0].totalDryer),
  };
};

module.exports = { getMitra, getCabang, getMesin };
