const dbPool = require("../config/database");
const { formatTanggalWIB, formatJamWIB, getJakartaSqlDate } = require("../utils/date");
const { createHttpError } = require("../utils/httpError");

const getHistoryTransaksi = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        ${getJakartaSqlDate("o.waktuOrder")} AS tanggalGroup,
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
        ${getJakartaSqlDate("o.waktuOrder")},
        o.idUserMobile, 
        k.namaLengkap
      ORDER BY 
        tanggalGroup DESC, 
        totalTransaksiKasir DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw createHttpError(404, "Data tidak ditemukan", "HISTORY_NOT_FOUND");
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

const getHistoryTransaksiKasir = async ({ cabangId, tanggal, namaKasir }) => {
  try {
    let SQLQuery = `
      SELECT 
        ${getJakartaSqlDate("o.waktuOrder")} AS tanggalGroup,
        u.namaLengkap AS namaKasir,
        SUM(CASE WHEN d.jenisLayanan IN ('cuci', 'kering') THEN 1 ELSE 0 END) AS jumlahTransaksi
      FROM tbl_order_laundry o
      LEFT JOIN tbl_users_mobile u ON o.idUserMobile = u.id
      LEFT JOIN tbl_detail_order d ON d.orderId = o.id
      WHERE o.cabangId = ?
    `;
    const values = [cabangId];

    if (tanggal) {
      SQLQuery += ` AND ${getJakartaSqlDate("o.waktuOrder")} = ?`;
      values.push(tanggal);
    }

    if (namaKasir) {
      SQLQuery += " AND u.namaLengkap LIKE ?";
      values.push(`%${namaKasir}%`);
    }

    SQLQuery += `
      GROUP BY ${getJakartaSqlDate("o.waktuOrder")}, u.namaLengkap
      ORDER BY tanggalGroup DESC, u.namaLengkap ASC
    `;

    const [rows] = await dbPool.execute(SQLQuery, values);

    if (rows.length === 0) {
      throw createHttpError(404, "Data tidak ditemukan", "HISTORY_NOT_FOUND");
    }

    return rows.map((row) => ({
      namaKasir: row.namaKasir || "Sistem",
      jumlahTransaksi: Number(row.jumlahTransaksi) || 0,
      tanggalTampilan: formatTanggalWIB(row.tanggalGroup),
      tanggalLengkap: row.tanggalGroup ? new Date(row.tanggalGroup).toISOString() : "",
    }));
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
        COALESCE(u.namaLengkap, NULLIF(l.actorUsername, '')) AS namaOperator,
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
      throw createHttpError(404, "Data tidak ditemukan", "HISTORY_NOT_FOUND");
    }

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
  getHistoryTransaksiKasir,
  getHistoryMesin,
};
