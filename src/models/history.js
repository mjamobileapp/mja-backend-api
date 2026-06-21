const dbPool = require("../config/database");

const getHistoryTransaksi = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        DATE_FORMAT(o.waktuOrder, '%Y-%m-%d') AS tanggalGroup,
        o.idUserMobile AS idKasir,
        k.namaLengkap AS namaKasir,
        COUNT(o.id) AS totalTransaksiKasir,
        SUM(CASE WHEN o.metodePembayaran = 'CASH' THEN 1 ELSE 0 END) AS totalCash,
        SUM(CASE WHEN o.metodePembayaran = 'QRIS' THEN 1 ELSE 0 END) AS totalQris
      FROM tbl_order_laundry o
      LEFT JOIN tbl_users_mobile k ON o.idUserMobile = k.id
      WHERE o.cabangId = ? 
        AND o.idMitra = ?
        AND (o.statusPembayaran = 'PAID' OR o.statusPembayaran IS NULL)
      GROUP BY 
        DATE_FORMAT(o.waktuOrder, '%Y-%m-%d'), 
        o.idUserMobile, 
        k.namaLengkap
      ORDER BY 
        tanggalGroup DESC, 
        totalTransaksiKasir DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    // Grouping per tanggal
    const groupedData = {};

    rows.forEach(row => {
      const tglKey = row.tanggalGroup;

      if (!groupedData[tglKey]) {
        groupedData[tglKey] = {
          tanggalTampilan: tglKey,
          totalTransaksiHariIni: 0,
          rincianKasir: []
        };
      }

      groupedData[tglKey].rincianKasir.push({
        idKasir: row.idKasir,
        namaKasir: row.namaKasir || 'Sistem',
        totalCash: Number(row.totalCash),
        totalQris: Number(row.totalQris),
        totalTransaksiKasir: Number(row.totalTransaksiKasir)
      });

      groupedData[tglKey].totalTransaksiHariIni += Number(row.totalTransaksiKasir);
    });

    // Ubah Object menjadi Array
    const finalResponse = Object.values(groupedData);

    return finalResponse;
  } catch (error) {
    throw error;
  }
};

const getHistoryMesin = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        l.id AS idLog,
        m.namaGroupMesin AS namaMesin,
        d.jenisMesin,
        u.namaLengkap AS namaOperator,
        l.waktuLog AS waktuLengkap
      FROM tbl_log_mesin l
      JOIN tbl_mesin_detail d ON l.mesinId = d.id
      JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
      LEFT JOIN tbl_users_mobile u ON l.kasirId = u.id
      WHERE m.cabangId = ? 
        AND m.idMitra = ?
        AND l.statusPerintah = 'success'
      ORDER BY l.waktuLog DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    // Format jam ke format "HH:mm WIB"
    const formatJamWIB = (dateString) => {
      const date = new Date(dateString);
      const jam = String(date.getHours()).padStart(2, '0');
      const menit = String(date.getMinutes()).padStart(2, '0');
      return `${jam}:${menit} WIB`;
    };

    // Mapping data mentah dari SQL ke format JSON UI
    const finalResponse = rows.map(row => {
      return {
        idLog: row.idLog,
        namaMesin: row.namaMesin,
        namaOperator: row.namaOperator || 'Sistem',
        jenisMesin: row.jenisMesin,
        waktuAktifTampilan: formatJamWIB(row.waktuLengkap),
        waktuLengkap: row.waktuLengkap,
      };
    });

    return finalResponse;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getHistoryTransaksi,
  getHistoryMesin,
};