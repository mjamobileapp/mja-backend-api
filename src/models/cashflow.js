const dbPool = require("../config/database");
const { formatTanggalJamWIB, getDateFilterCondition, getJakartaSqlDate } = require("../utils/date");
const { withTransaction } = require("../utils/transaction");

const getCashflow = (cabangId, idMitra, cabangId2, idMitra2, filter) => {
  const pemasukanDateFilter = getDateFilterCondition("waktuOrder", filter);
  const pengeluaranDateFilter = getDateFilterCondition("waktuPengeluaran", filter);
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
     AND ${pemasukanDateFilter}
  ) AS pemasukan
  
CROSS JOIN 
  
  -- 2. Ruangan Pengeluaran
  (SELECT IFNULL(SUM(nominal), 0) AS total 
   FROM tbl_pengeluaran 
   WHERE cabangId = ? AND idMitra = ?
     AND statusAktif = 1
     AND ${pengeluaranDateFilter}
  ) AS pengeluaran
  `;
  return dbPool.execute(SQLQuery, [cabangId, idMitra, cabangId2, idMitra2]);
};

const getPendapatan = async (cabangId, idMitra, filter) => {
  try {
    const dateFilter = getDateFilterCondition("o.waktuOrder", filter);
    const [rows] = await dbPool.execute(
      `SELECT 
        o.id AS idTransaksi,
        ${getJakartaSqlDate("o.waktuOrder")} AS tanggalGroup,
        o.waktuOrder AS waktuDetail,
        o.totalBayar AS nominal,
        k.namaLengkap AS namaKasir
      FROM tbl_order_laundry o
      LEFT JOIN tbl_users_mobile k ON o.idUserMobile = k.id
      WHERE o.cabangId = ? 
        AND o.idMitra = ?
        AND o.statusPembayaran = 'PAID'
        AND ${dateFilter}
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
      return String(b.tanggalTampilan).localeCompare(String(a.tanggalTampilan));
    });

    return result;
  } catch (error) {
    throw error;
  }
};

const getPengeluaran = async (cabangId, idMitra, filter) => {
  try {
    const dateFilter = getDateFilterCondition("p.waktuPengeluaran", filter);
    const [rows] = await dbPool.execute(
      `SELECT 
        p.id AS idPengeluaran,
        ${getJakartaSqlDate("p.waktuPengeluaran")} AS tanggalGroup,
        p.waktuPengeluaran AS waktuDetail,
        CONCAT(i.namaItem, ' (x', p.jumlahBarang, ')') AS deskripsi,
        p.nominal,
        u.namaLengkap AS namaKasir
      FROM tbl_pengeluaran p
      LEFT JOIN tbl_users_mobile u ON p.idUserMobile = u.id
      LEFT JOIN tbl_master_item_expense i ON p.itemId = i.id
      WHERE p.cabangId = ? 
        AND p.idMitra = ? 
        AND p.statusAktif = 1
        AND ${dateFilter}
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
      return String(b.tanggalTampilan).localeCompare(String(a.tanggalTampilan));
    });

    return result;
  } catch (error) {
    throw error;
  }
};

const getListPengeluaran = async (cabangId, idMitra, filter) => {
  try {
    const dateFilter = getDateFilterCondition("p.waktuPengeluaran", filter);
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
        AND p.idMitra = ?
        AND p.statusAktif = 1
        AND ${dateFilter}
      ORDER BY p.waktuPengeluaran DESC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    const formattedData = rows.map(row => ({
      idPengeluaran: row.idPengeluaran,
      deskripsi: row.deskripsi,
      namaKasir: row.namaKasir || 'Sistem',
      nominalRupiah: `Rp ${Number(row.nominal).toLocaleString('id-ID')}`,
      nominalAngka: Number(row.nominal),
      waktuTampilan: formatTanggalJamWIB(row.waktuLengkap),
      waktuLengkap: row.waktuLengkap,
    }));

    return formattedData;
  } catch (error) {
    throw error;
  }
};

const isCabangOwnedByMitra = async (cabangId, idMitra) => {
  const [rows] = await dbPool.execute(
    "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ?",
    [cabangId, idMitra]
  );

  return rows.length > 0;
};

const getPengeluaranById = async (id, idMitra, filter, cabangId = null) => {
  try {
    const dateFilter = getDateFilterCondition("p.waktuPengeluaran", filter);
    const cabangFilter = cabangId ? " AND p.cabangId = ?" : "";
    const values = [id, idMitra];
    if (cabangId) values.push(cabangId);
    const [rows] = await dbPool.execute(
      `SELECT 
        p.id,
        p.idMitra,
        m.namaMitra,
        p.cabangId,
        c.namaCabang,
        p.idUserMobile,
        u.namaLengkap AS namaKasir,
        p.itemId,
        p.jumlahBarang,
        p.nominal,
        p.waktuPengeluaran,
        p.createdDate
      FROM tbl_pengeluaran p
      LEFT JOIN tbl_mitra m ON p.idMitra = m.id
      LEFT JOIN tbl_cabang c ON p.cabangId = c.id
      LEFT JOIN tbl_users_mobile u ON p.idUserMobile = u.id
      WHERE p.id = ?
        AND p.idMitra = ?
        AND p.statusAktif = 1
        ${cabangFilter}
        AND ${dateFilter}`,
      values
    );

    if (rows.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    const row = rows[0];

    return {
      id: row.id,
      idMitra: String(row.idMitra),
      namaMitra: row.namaMitra || "",
      cabangId: String(row.cabangId),
      namaCabang: row.namaCabang || "",
      idUserMobile: String(row.idUserMobile),
      namaKasir: row.namaKasir || "",
      itemId: row.itemId,
      jumlahBarang: row.jumlahBarang,
      nominal: row.nominal,
      waktuPengeluaran: row.waktuPengeluaran ? new Date(row.waktuPengeluaran).toISOString() : "",
      createdDate: row.createdDate ? new Date(row.createdDate).toISOString() : "",
    };
  } catch (error) {
    throw error;
  }
};

const createPengeluaran = async (data) => {
  const { idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal } = data;
  return withTransaction(async (connection) => {

    // 1. Validasi idMitra
    const [mitraCheck] = await connection.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
      [idMitra]
    );
    if (mitraCheck.length === 0) {
      throw new Error("Mitra tidak ditemukan");
    }

    // 2. Validasi cabangId (cek juga milik mitra yang sama)
    const [cabangCheck] = await connection.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = 1",
      [cabangId, idMitra]
    );
    if (cabangCheck.length === 0) {
      throw new Error("Cabang tidak ditemukan");
    }

    // 3. Validasi idUserMobile
    const [userCheck] = await connection.execute(
      "SELECT id, namaLengkap FROM tbl_users_mobile WHERE id = ? AND statusAktif = 1",
      [idUserMobile]
    );
    if (userCheck.length === 0) {
      throw new Error("User tidak ditemukan");
    }

    // 4. Validasi itemId
    const [itemCheck] = await connection.execute(
      "SELECT id, tipeItem FROM tbl_master_item_expense WHERE id = ? AND statusAktif = 1",
      [itemId]
    );
    if (itemCheck.length === 0) {
      throw new Error("Item tidak ditemukan");
    }

    // 5. INSERT pengeluaran
    const jumlahBarangValue = jumlahBarang || 0;
    const [result] = await connection.execute(
      `INSERT INTO tbl_pengeluaran (idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal, waktuPengeluaran)
       VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [idMitra, cabangId, idUserMobile, itemId, jumlahBarangValue, nominal]
    );

    // 6. Tambahkan stok cabang jika item bertipe stok
    if (itemCheck[0].tipeItem === "stok" && jumlahBarangValue > 0) {
      const createdBy = userCheck[0].namaLengkap || String(idUserMobile);

      await connection.execute(
        `INSERT INTO tbl_stok_cabang (idMitra, cabangId, itemId, stokSekarang, createdBy, updatedBy)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           stokSekarang = stokSekarang + VALUES(stokSekarang),
           updatedBy = VALUES(updatedBy),
           updatedDate = CURRENT_TIMESTAMP`,
        [idMitra, cabangId, itemId, jumlahBarangValue, createdBy, createdBy]
      );
    }

    // 7. Ambil data yang baru diinsert untuk response
    const [newData] = await connection.execute(
      `SELECT id, idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal, waktuPengeluaran, createdDate
       FROM tbl_pengeluaran WHERE id = ?`,
      [result.insertId]
    );

    if (newData.length === 0) {
      throw new Error("Gagal mengambil data pengeluaran");
    }

    const row = newData[0];

    return {
      id: row.id,
      idMitra: String(row.idMitra),
      cabangId: String(row.cabangId),
      idUserMobile: String(row.idUserMobile),
      itemId: row.itemId,
      jumlahBarang: row.jumlahBarang,
      nominal: row.nominal,
      waktuPengeluaran: row.waktuPengeluaran ? new Date(row.waktuPengeluaran).toISOString() : "",
      createdDate: row.createdDate ? new Date(row.createdDate).toISOString() : "",
    };
  });
};

const updatePengeluaran = async (body, id, idMitra, cabangId = null) => {
  try {
    const { itemId, jumlahBarang, nominal } = body;
    const cabangFilter = cabangId ? " AND cabangId = ?" : "";
    const scopedValues = [id, idMitra];
    if (cabangId) scopedValues.push(cabangId);

    const [existingPengeluaran] = await dbPool.execute(
      `SELECT id FROM tbl_pengeluaran WHERE id = ? AND idMitra = ? AND statusAktif = 1${cabangFilter}`,
      scopedValues
    );

    if (existingPengeluaran.length === 0) {
      throw new Error("data not found");
    }

    const [itemCheck] = await dbPool.execute(
      "SELECT id FROM tbl_master_item_expense WHERE id = ? AND statusAktif = 1",
      [itemId]
    );

    if (itemCheck.length === 0) {
      throw new Error("Item tidak ditemukan");
    }

    await dbPool.execute(
      `UPDATE tbl_pengeluaran
        SET itemId = ?, jumlahBarang = ?, nominal = ?
       WHERE id = ? AND idMitra = ?${cabangFilter}`,
      [itemId, jumlahBarang, nominal, ...scopedValues]
    );

    const [updatedData] = await dbPool.execute(
      `SELECT id, idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal, waktuPengeluaran, createdDate
       FROM tbl_pengeluaran WHERE id = ? AND idMitra = ? AND statusAktif = 1${cabangFilter}`,
      scopedValues
    );

    const row = updatedData[0];

    return {
      id: row.id,
      idMitra: String(row.idMitra),
      cabangId: String(row.cabangId),
      idUserMobile: String(row.idUserMobile),
      itemId: row.itemId,
      jumlahBarang: row.jumlahBarang,
      nominal: row.nominal,
      waktuPengeluaran: row.waktuPengeluaran ? new Date(row.waktuPengeluaran).toISOString() : "",
      createdDate: row.createdDate ? new Date(row.createdDate).toISOString() : "",
    };
  } catch (error) {
    throw error;
  }
};

const deletePengeluaran = async (id, idMitra, cabangId = null) => {
  try {
    const cabangFilter = cabangId ? " AND cabangId = ?" : "";
    const scopedValues = [id, idMitra];
    if (cabangId) scopedValues.push(cabangId);
    const [existingPengeluaran] = await dbPool.execute(
      `SELECT id FROM tbl_pengeluaran WHERE id = ? AND idMitra = ? AND statusAktif = 1${cabangFilter}`,
      scopedValues
    );

    if (existingPengeluaran.length === 0) {
      throw new Error("Data tidak ditemukan");
    }

    const SQLQuery = `UPDATE tbl_pengeluaran SET statusAktif = 0 WHERE id = ? AND idMitra = ?${cabangFilter}`;
    return dbPool.execute(SQLQuery, scopedValues);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getCashflow,
  getPendapatan,
  getPengeluaran,
  getListPengeluaran,
  isCabangOwnedByMitra,
  getPengeluaranById,
  createPengeluaran,
  updatePengeluaran,
  deletePengeluaran,
};
