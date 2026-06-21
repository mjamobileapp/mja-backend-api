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

module.exports = {
  getHistoryTransaksi,
};