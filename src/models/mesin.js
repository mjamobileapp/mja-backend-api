const dbPool = require("../config/database");

const createNewMesin = async (body, createdBy = null) => {
  try {
    const { idMitra, cabangId, espId, washer, dryer } = body;

    // 1. Validasi Mitra Exist
    const [existingMitra] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw new Error("Mitra tidak ditemukan atau tidak aktif");
    }

    // 2. Validasi Cabang Exist dan sesuai dengan Mitra
    const [existingCabang] = await dbPool.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = TRUE",
      [cabangId, idMitra]
    );
    if (existingCabang.length === 0) {
      throw new Error("Cabang tidak ditemukan / tidak aktif / tidak sesuai dengan Mitra");
    }

    // 3. Hitung jumlah grup mesin (espId unik) yang sudah ada di cabang tersebut
    const [countResult] = await dbPool.query(
      "SELECT COUNT(DISTINCT espId) AS totalGrupMesin FROM tbl_mesin WHERE idMitra = ? AND cabangId = ?",
      [idMitra, cabangId]
    );
    
    // 4. Tentukan nomor urut dan nama otomatis
    const urutanBaru = (countResult[0]?.totalGrupMesin || 0) + 1;
    const namaMesinOtomatis = `Mesin Laundry ${urutanBaru}`;

    // 5. Siapkan keranjang data (Bulk Insert Array)
    const values = [];

    // 6. Jika washer = 1 (TRUE)
    if (washer === 1) {
      // Validasi duplikasi espId + tipeMesin
      const [existingWasher] = await dbPool.execute(
        "SELECT id FROM tbl_mesin WHERE espId = ? AND tipeMesin = 'WASHER'",
        [espId]
      );
      if (existingWasher.length > 0) {
        throw new Error("Mesin dengan espId dan tipe WASHER yang sama sudah terdaftar");
      }
      values.push([idMitra, cabangId, espId, 5, namaMesinOtomatis, 'WASHER', createdBy]);
    }

    // 7. Jika dryer = 1 (TRUE)
    if (dryer === 1) {
      // Validasi duplikasi espId + tipeMesin
      const [existingDryer] = await dbPool.execute(
        "SELECT id FROM tbl_mesin WHERE espId = ? AND tipeMesin = 'DRYER'",
        [espId]
      );
      if (existingDryer.length > 0) {
        throw new Error("Mesin dengan espId dan tipe DRYER yang sama sudah terdaftar");
      }
      values.push([idMitra, cabangId, espId, 4, namaMesinOtomatis, 'DRYER', createdBy]);
    }

    // 8. Validasi minimal satu data
    if (values.length === 0) {
      throw new Error("Minimal harus mengisi satu data mesin (Washer atau Dryer)");
    }

    // 9. Insert ke database
    const query = `INSERT INTO tbl_mesin 
      (idMitra, cabangId, espId, channelRelay, namaMesin, tipeMesin, createdBy) 
      VALUES ?`;
    
    const [result] = await dbPool.query(query, [values]);

    // 10. Map hasil insertId untuk response
    let washerResult = null;
    let dryerResult = null;
    
    if (washer === 1) {
      washerResult = {
        id: result.insertId,
        namaMesin: namaMesinOtomatis,
        status: "Ready",
      };
    }
    
    if (dryer === 1) {
      const dryerInsertId = washer === 1 ? result.insertId + 1 : result.insertId;
      dryerResult = {
        id: dryerInsertId,
        namaMesin: namaMesinOtomatis,
        status: "Ready",
      };
    }

    return {
      idMitra,
      cabangId,
      espId,
      washer: washerResult,
      dryer: dryerResult,
    };
  } catch (error) {
    throw error;
  }
};

const updateMesin = async (espIdParam, body, updatedBy) => {
  const { idMitra, cabangId, espId, washer, dryer } = body;
  
  const connection = await dbPool.getConnection();
  await connection.beginTransaction();
  
  try {
    // 1. Dapatkan namaMesin bawaan dari database (Agar namanya tidak berubah)
    const [existingData] = await connection.execute(
      `SELECT namaMesin FROM tbl_mesin WHERE espId = ? AND idMitra = ? LIMIT 1`,
      [espIdParam, idMitra]
    );

    if (existingData.length === 0) {
      throw new Error("Modul mesin tidak ditemukan di sistem.");
    }
    
    const namaMesinAsli = existingData[0].namaMesin;

    // 2. Fungsi Internal untuk Sinkronisasi (Upsert / Delete)
    const syncMesin = async (jenis, isAktif, channelPin) => {
      let currentId = null;

      if (isAktif === 1) {
        // Cek apakah data spesifik (WASHER/DRYER) ini sudah ada di tabel
                const [cekMesin] = await connection.execute(
          `SELECT id FROM tbl_mesin WHERE espId = ? AND tipeMesin = ? AND idMitra = ? AND statusAktif = 1`,
          [espId, jenis, idMitra]
        );

        if (cekMesin.length > 0) {
          // KONDISI A: Mesin sudah ada -> Lakukan UPDATE (Mungkin Admin pindah cabang)
          currentId = cekMesin[0].id;
          await connection.execute(
            `UPDATE tbl_mesin SET cabangId = ?, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP WHERE id = ?`,
            [cabangId, updatedBy, currentId]
          );
        } else {
          // KONDISI B: Mesin belum ada -> Lakukan INSERT (Admin baru membeli mesin ini)
          const [result] = await connection.execute(
            `INSERT INTO tbl_mesin (idMitra, cabangId, espId, channelRelay, namaMesin, tipeMesin, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [idMitra, cabangId, espId, channelPin, namaMesinAsli, jenis, updatedBy]
          );
          currentId = result.insertId;
        }
            } else {
        // KONDISI C: Jika payload = 0 -> Lakukan SOFT DELETE (set statusAktif = 0)
        await connection.execute(
          `UPDATE tbl_mesin SET statusAktif = 0, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP WHERE espId = ? AND tipeMesin = ? AND idMitra = ?`,
          [updatedBy, espId, jenis, idMitra]
        );
      }
      return currentId;
    };

    // 3. Eksekusi Sinkronisasi untuk Washer (Pin 5) dan Dryer (Pin 4)
    const idWasher = await syncMesin('WASHER', washer, 5);
    const idDryer = await syncMesin('DRYER', dryer, 4);

    // Selesai, simpan permanen
    await connection.commit();

    return {
      idMitra,
      cabangId,
      espId,
      washer: washer === 1 ? { id: idWasher, namaMesin: namaMesinAsli, status: "Ready" } : null,
      dryer: dryer === 1 ? { id: idDryer, namaMesin: namaMesinAsli, status: "Ready" } : null,
    };
  } catch (error) {
    // Batalkan semua perubahan jika terjadi error
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteMesin = async (id, updatedBy) => {
  try {
    // 1. Cek apakah mesin eksis dan aktif
    const [existingMesin] = await dbPool.execute(
      "SELECT id, status FROM tbl_mesin WHERE id = ? AND statusAktif = 1",
      [id]
    );
    
    if (existingMesin.length === 0) {
      throw new Error("data not found");
    }

    // 2. Tolak jika mesin sedang menyala (status = in_use)
    if (existingMesin[0].status === "in_use") {
      throw new Error("Mesin sedang menyala");
    }

    // 3. Soft delete: update statusAktif menjadi 0 dan update updatedBy
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_mesin SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    const [result] = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);

    return result;
  } catch (error) {
    throw error;
  }
};

const getMesinById = async (id) => {
  try {
    const [mesin] = await dbPool.execute(
      "SELECT * FROM tbl_mesin WHERE id = ?",
      [id]
    );
    if (mesin.length === 0) {
      throw new Error("data not found");
    }
    return mesin[0];
  } catch (error) {
    throw error;
  }
};

const getAllMesin = async (status) => {
  try {
    let SQLQuery = "SELECT m.*, mitra.namaMitra, cabang.namaCabang FROM tbl_mesin m LEFT JOIN tbl_mitra mitra ON m.idMitra = mitra.id LEFT JOIN tbl_cabang cabang ON m.cabangId = cabang.id";

    if (status === "all") {
      // Ambil semua data tanpa filter
    } else if (status === "inactive") {
      // Ambil hanya yang nonaktif
       SQLQuery += " WHERE m.statusAktif = 0";
    } else {
      // Default: Ambil hanya yang aktif
      SQLQuery += " WHERE m.statusAktif = 1";
    }

    const [mesins] = await dbPool.execute(SQLQuery);
    return mesins;
  } catch (error) {
    throw error;
  }
};

const getMesinByIdMitra = async (idMitra) => {
  try {
    const [mesins] = await dbPool.execute(
      "SELECT m.*, mitra.namaMitra, cabang.namaCabang FROM tbl_mesin m LEFT JOIN tbl_mitra mitra ON m.idMitra = mitra.id LEFT JOIN tbl_cabang cabang ON m.cabangId = cabang.id WHERE m.idMitra = ? AND m.statusAktif = 1",
      [idMitra]
    );
    return mesins;
  } catch (error) {
    throw error;
  }
};

const getMesinByIdCabang = async (cabangId) => {
  try {
    const [mesins] = await dbPool.execute(
      "SELECT m.*, mitra.namaMitra, cabang.namaCabang FROM tbl_mesin m LEFT JOIN tbl_mitra mitra ON m.idMitra = mitra.id LEFT JOIN tbl_cabang cabang ON m.cabangId = cabang.id WHERE m.cabangId = ? AND m.statusAktif = 1",
      [cabangId]
    );
    return mesins;
  } catch (error) {
    throw error;
  }
};

const restoreMesin = async (id, updatedBy) => {
  try {
    // Check if mesin exists and is currently inactive
    const [existingMesin] = await dbPool.execute(
      "SELECT id FROM tbl_mesin WHERE id = ? AND statusAktif = 0",
      [id]
    );
    if (existingMesin.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Execute UPDATE query to set statusAktif back to 1 (true)
    const SQLQuery = "UPDATE tbl_mesin SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    const result = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);

    return result;
  } catch (error) {
    throw error;
  }
};

const getMesinByEspId = async (espId) => {
  try {
    const [mesins] = await dbPool.execute(
      "SELECT * FROM tbl_mesin WHERE espId = ? AND statusAktif = TRUE",
      [espId]
    );
    if (mesins.length === 0) {
      throw new Error("Data not found");
    }

    // Map ke format response: washer dan dryer sebagai 1 (ada) atau 0 (tidak ada)
    let hasWasher = 0;
    let hasDryer = 0;
    let idMitra = null;
    let cabangId = null;

    for (const item of mesins) {
      idMitra = item.idMitra;
      cabangId = item.cabangId;
      if (item.tipeMesin === 'WASHER') {
        hasWasher = 1;
      } else if (item.tipeMesin === 'DRYER') {
        hasDryer = 1;
      }
    }

    return {
      idMitra,
      cabangId,
      espId,
      washer: hasWasher,
      dryer: hasDryer,
    };
  } catch (error) {
    throw error;
  }
};

const getListMesinMobile = async (cabangId, idMitra) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT id, espId, namaMesin, tipeMesin AS jenisMesin, status, waktuSelesai 
      FROM tbl_mesin 
      WHERE cabangId = ? AND idMitra = ? AND statusAktif = 1
      ORDER BY id ASC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw new Error("Data not found");
    }

    // Siapkan wadah untuk Grouping
    const groupedData = {};
    let nomorUrut = 1;

    // Looping dan Kelompokkan berdasarkan espId
    rows.forEach((row) => {
      // Jika espId ini belum ada di wadah, buatkan "Kartu" baru
      if (!groupedData[row.espId]) {
        groupedData[row.espId] = {
          nomorUrut: String(nomorUrut).padStart(2, '0'),
          namaGroupMesin: row.namaMesin,
          espId: row.espId,
          washer: null,
          dryer: null,
        };
        nomorUrut++;
      }

      // Masukkan data spesifik Washer / Dryer ke dalam "Kartu" tersebut
      const detailMesin = {
        idDb: row.id,
        status: row.status,
        waktuSelesai: row.status === 'IN_USE' ? row.waktuSelesai : null,
      };

      if (row.jenisMesin === 'WASHER') {
        groupedData[row.espId].washer = detailMesin;
      } else if (row.jenisMesin === 'DRYER') {
        groupedData[row.espId].dryer = detailMesin;
      }
    });

    // Ubah objek (dictionary) kembali menjadi Array
    return Object.values(groupedData);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createNewMesin,
  updateMesin,
  deleteMesin,
  restoreMesin,
  getMesinById,
  getAllMesin,
  getMesinByIdMitra,
  getMesinByIdCabang,
  getMesinByEspId,
  getListMesinMobile,
};
