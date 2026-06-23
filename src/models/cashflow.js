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

const getPendapatan = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        o.id AS idTransaksi,
        DATE(o.waktuOrder) AS tanggalGroup,
        o.waktuOrder AS waktuDetail,
        o.totalBayar AS nominal,
        k.namaLengkap AS namaKasir
      FROM tbl_order_laundry o
      LEFT JOIN tbl_users_mobile k ON o.idUserMobile = k.id
      WHERE o.cabangId = ? 
        AND o.idMitra = ?
        AND o.statusPembayaran = 'LUNAS'
      ORDER BY o.waktuOrder DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    // Grouping per tanggal
    const groupedData = {};

    rows.forEach((row) => {
      const tanggal = row.tanggalGroup;

      if (!groupedData[tanggal]) {
        groupedData[tanggal] = {
          tanggalTampilan: tanggal,
          totalPendapatanHariIni: 0,
          rincian: [],
        };
      }

      groupedData[tanggal].totalPendapatanHariIni += row.nominal;

      const nominalRupiah = `Rp ${row.nominal.toLocaleString('id-ID')}`;

      groupedData[tanggal].rincian.push({
        idTransaksi: row.idTransaksi,
        waktuLengkap: row.waktuDetail,
        namaKasir: row.namaKasir,
        nominalRupiah: nominalRupiah,
        nominalAngka: row.nominal,
      });
    });

    // Urutkan DESC berdasarkan tanggal
    const result = Object.values(groupedData).sort((a, b) => {
      return b.tanggalTampilan.localeCompare(a.tanggalTampilan);
    });

    return result;
  } catch (error) {
    throw error;
  }
};

const getPengeluaran = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        p.id AS idPengeluaran,
        DATE(p.waktuPengeluaran) AS tanggalGroup,
        p.waktuPengeluaran AS waktuDetail,
        CONCAT(i.namaItem, ' (x', p.jumlahBarang, ')') AS deskripsi,
        p.nominal,
        u.namaLengkap AS namaKasir
      FROM tbl_pengeluaran p
      LEFT JOIN tbl_users_mobile u ON p.idUserMobile = u.id
      LEFT JOIN tbl_master_item_expense i ON p.itemId = i.id
      WHERE p.cabangId = ? 
        AND p.idMitra = ? 
      ORDER BY p.waktuPengeluaran DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    // Grouping per tanggal
    const groupedData = {};

    rows.forEach((row) => {
      const tanggal = row.tanggalGroup;

      if (!groupedData[tanggal]) {
        groupedData[tanggal] = {
          tanggalTampilan: tanggal,
          totalPengeluaranHariIni: 0,
          rincian: [],
        };
      }

      groupedData[tanggal].totalPengeluaranHariIni += row.nominal;

      const nominalRupiah = `Rp ${row.nominal.toLocaleString('id-ID')}`;

      groupedData[tanggal].rincian.push({
        idPengeluaran: row.idPengeluaran,
        waktuLengkap: row.waktuDetail,
        deskripsi: row.deskripsi,
        namaKasir: row.namaKasir,
        nominalRupiah: nominalRupiah,
        nominalAngka: row.nominal,
      });
    });

    // Urutkan DESC berdasarkan tanggal
    const result = Object.values(groupedData).sort((a, b) => {
      return b.tanggalTampilan.localeCompare(a.tanggalTampilan);
    });

    return result;
  } catch (error) {
    throw error;
  }
};

const getListPengeluaran = async (cabangId) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        p.id AS idPengeluaran,
        CONCAT(i.namaItem, CASE WHEN p.jumlahBarang > 0 THEN CONCAT(' (x', p.jumlahBarang, ')') ELSE '' END) AS deskripsi,
        p.nominal,
        u.namaLengkap AS namaKasir,
        p.waktuPengeluaran AS waktuLengkap
      FROM tbl_pengeluaran p
      LEFT JOIN tbl_users_mobile u ON p.idUserMobile = u.id
      LEFT JOIN tbl_master_item_expense i ON p.itemId = i.id
      WHERE p.cabangId = ? 
      ORDER BY p.waktuPengeluaran DESC`,
      [cabangId]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    // Format data
    const formatTanggalWIB = (dateString) => {
      const date = new Date(dateString);
      const tgl = String(date.getDate()).padStart(2, '0');
      const bln = String(date.getMonth() + 1).padStart(2, '0');
      const thn = date.getFullYear();
      const jam = String(date.getHours()).padStart(2, '0');
      const menit = String(date.getMinutes()).padStart(2, '0');
      return `${tgl}/${bln}/${thn} ${jam}:${menit} WIB`;
    };

    const formattedData = rows.map(row => ({
      idPengeluarans: row.idPengeluaran,
      deskripsi: row.deskripsi,
      namaKasir: row.namaKasir || 'Sistem',
      nominalRupiah: `Rp ${Number(row.nominal).toLocaleString('id-ID')}`,
      nominalAngka: Number(row.nominal),
      waktuTampilan: formatTanggalWIB(row.waktuLengkap),
      waktuLengkap: row.waktuLengkap,
    }));

    return formattedData;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getCashflow,
  getPendapatan,
  getPengeluaran,
  getListPengeluaran,
};