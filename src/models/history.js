const dbPool = require("../config/database");
const { formatTanggalWIB, formatJamWIB, getDateFilterCondition, getJakartaSqlDate } = require("../utils/date");
const { createHttpError } = require("../utils/httpError");

const getHistoryTransaksi = async (cabangId, idMitra, periode) => {
  const dateFilter = getDateFilterCondition("o.waktuOrder", periode);
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
    LEFT JOIN tbl_detail_order d ON d.orderId = o.id
    WHERE o.cabangId = ?
      AND o.idMitra = ?
      AND (o.statusPembayaran = 'PAID' OR o.statusPembayaran IS NULL)
      AND ${dateFilter}
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
};

const getHistoryTransaksiKasir = async ({ cabangId, tanggal, periode, namaKasir }) => {
  const dateFilter = getDateFilterCondition("o.waktuOrder", periode);
  let SQLQuery = `
    SELECT
      ${getJakartaSqlDate("o.waktuOrder")} AS tanggalGroup,
      u.namaLengkap AS namaKasir,
      SUM(CASE WHEN d.jenisLayanan IN ('cuci', 'kering') THEN 1 ELSE 0 END) AS jumlahTransaksi
    FROM tbl_order_laundry o
    LEFT JOIN tbl_users_mobile u ON o.idUserMobile = u.id
    LEFT JOIN tbl_detail_order d ON d.orderId = o.id
    WHERE o.cabangId = ?
      AND ${dateFilter}
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
};

const getHistoryMesin = async (cabangId, idMitra, periode) => {
  const dateFilter = getDateFilterCondition("l.waktuLog", periode);
  const [rows] = await dbPool.execute(
    `SELECT
      l.id AS idLog,
      m.namaGroupMesin AS namaMesin,
      d.jenisMesin,
      COALESCE(u.namaLengkap, NULLIF(l.actorUsername, '')) AS namaOperator,
      l.waktuLog AS waktuLengkap,
      l.commandType AS perintahMesin
    FROM tbl_log_mesin l
    JOIN tbl_mesin_detail d ON l.mesinId = d.id
    JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
    LEFT JOIN tbl_users_mobile u ON l.kasirId = u.id
    WHERE m.cabangId = ?
      AND m.idMitra = ?
      AND l.statusPerintah = 'success'
      AND ${dateFilter}
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
      perintahMesin: row.perintahMesin,
    };
  });

  return finalResponse;
};

const getHistoryMesinBackoffice = async ({ mitraId, cabangId, commandType, date }) => {
  // Base query
  let sql = `
    SELECT
      lm.id,
      lm.waktuLog,
      lm.idMitra, m.namaMitra,
      lm.cabangId, c.namaCabang,
      lm.mesinId,
      mm.namaGroupMesin,
      tmd.jenisMesin,
      lm.actorType,
      lm.actorId,
      lm.actorUsername,
      lm.commandType,
      lm.invoiceNumber,
      lm.statusPerintah,
      lm.errorMessage
    FROM tbl_log_mesin lm
    LEFT JOIN tbl_mitra m ON lm.idMitra = m.id
    LEFT JOIN tbl_cabang c ON lm.cabangId = c.id
    LEFT JOIN tbl_mesin_detail tmd ON lm.mesinId = tmd.id
    LEFT JOIN tbl_mesin_master mm ON tmd.idMesinMaster = mm.id
    WHERE 1=1
  `;
  const values = [];

  // Dynamic WHERE clause
  if (date) {
    sql += " AND DATE(lm.waktuLog) = ?";
    values.push(date);
  }

  if (mitraId && mitraId !== "all") {
    sql += " AND lm.idMitra = ?";
    values.push(mitraId);
  }

  if (cabangId && cabangId !== "all") {
    sql += " AND lm.cabangId = ?";
    values.push(cabangId);
  }

  if (commandType && commandType !== "all") {
    sql += " AND lm.commandType = ?";
    values.push(commandType);
  }

  sql += " ORDER BY lm.waktuLog DESC";

  const [rows] = await dbPool.execute(sql, values);

  // Formatting & Transformasi Data ke Nested JSON
  const items = rows.map((row) => {
    let jenisInstruksi = null;
    let keteranganReferensi = null;

    if (row.commandType === "ON" && row.invoiceNumber) {
      jenisInstruksi = "START";
      keteranganReferensi = "Sesuai transaksi";
    } else if (row.commandType === "OFF" && row.invoiceNumber) {
      jenisInstruksi = "STOP";
      keteranganReferensi = "Sesuai transaksi";
    } else if (row.commandType === "ON" && !row.invoiceNumber) {
      jenisInstruksi = "BYPASS_ON";
    } else if (row.commandType === "OFF" && !row.invoiceNumber) {
      jenisInstruksi = "BYPASS_OFF";
      keteranganReferensi =
        row.actorType === "backoffice"
          ? "Override Manual Internal"
          : "Tanpa Transaksi POS";
    }

    return {
      id: row.id,
      waktuLog: row.waktuLog,
      mitra: {
        id: row.idMitra,
        nama: row.namaMitra,
      },
      cabang: {
        id: row.cabangId,
        nama: row.namaCabang,
      },
      mesin: {
        id: row.mesinId,
        nama: row.namaGroupMesin,
        jenis: row.jenisMesin,
      },
      aktor: {
        type: row.actorType,
        id: row.actorId,
        username: row.actorUsername,
      },
      instruksi: {
        command: row.commandType,
        jenis: jenisInstruksi,
      },
      referensi: {
        invoiceNumber: row.invoiceNumber || null,
        keterangan: keteranganReferensi,
      },
      status: {
        isSuccess: row.statusPerintah === "success",
        message: row.statusPerintah,
        errorMessage: row.errorMessage || null,
      },
    };
  });

  return { items };
};

module.exports = {
  getHistoryTransaksi,
  getHistoryTransaksiKasir,
  getHistoryMesin,
  getHistoryMesinBackoffice,
};
