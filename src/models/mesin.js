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

    // 3. Validasi duplikasi espId + cabangId
    const [existingMaster] = await dbPool.execute(
      "SELECT id FROM tbl_mesin_master WHERE espId = ? AND cabangId = ?",
      [espId, cabangId]
    );
    if (existingMaster.length > 0) {
      throw new Error("Modul ESP ini sudah terdaftar di cabang yang sama");
    }

    // 4. Validasi minimal washer atau dryer
    if (washer !== 1 && dryer !== 1) {
      throw new Error("Minimal salah satu washer atau dryer harus bernilai 1");
    }

    // 5. Hitung jumlah modul (espId unik) yang sudah ada di cabang tersebut
    const [countResult] = await dbPool.query(
      `SELECT COUNT(DISTINCT espId) AS totalGrupMesin 
      FROM tbl_mesin_master 
      WHERE idMitra = ? AND cabangId = ?`,
      [idMitra, cabangId]
    );

    // 6. Tentukan nomor urut dan nama otomatis
    const urutanBaru = countResult[0].totalGrupMesin + 1;
    const namaGroupMesinOtomatis = `Mesin Laundry ${urutanBaru}`; 
    // Output: "Mesin Laundry 1", "Mesin Laundry 2", dst.

    // 7. INSERT ke tbl_mesin_master
    const [masterResult] = await dbPool.execute(
      `INSERT INTO tbl_mesin_master (idMitra, cabangId, espId, namaGroupMesin, createdBy) 
       VALUES (?, ?, ?, ?, ?)`,
      [idMitra, cabangId, espId, namaGroupMesinOtomatis, createdBy]
    );
    const idMesinMaster = masterResult.insertId;

    // 8. Insert Washer jika ada
    let washerResult = null;
    if (washer === 1) {
      const [detailWasher] = await dbPool.execute(
        `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, channelRelay, status) 
         VALUES (?, 'WASHER', 5, 'READY')`,
        [idMesinMaster]
      );
      washerResult = { id: detailWasher.insertId, status: "Ready" };
    }

    // 9. Insert Dryer jika ada
    let dryerResult = null;
    if (dryer === 1) {
      const [detailDryer] = await dbPool.execute(
        `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, channelRelay, status) 
         VALUES (?, 'DRYER', 4, 'READY')`,
        [idMesinMaster]
      );
      dryerResult = { id: detailDryer.insertId, status: "Ready" };
    }

    return {
      idMitra,
      cabangId,
      espId,
      namaGroupMesinOtomatis,
      washer: washerResult,
      dryer: dryerResult,
    };
  } catch (error) {
    throw error;
  }
};

const updateMesin = async (idMesinMaster, body, updatedBy) => {
  const { idMitra, cabangId, espId, washer, dryer } = body;

  const connection = await dbPool.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Dapatkan master ID dan namaGroupMesin bawaan dari database
    const [masterRecord] = await connection.execute(
      `SELECT id, namaGroupMesin FROM tbl_mesin_master WHERE id = ? AND idMitra = ? AND statusAktif = 1 LIMIT 1`,
      [idMesinMaster, idMitra]
    );

    if (masterRecord.length === 0) {
      throw new Error("Modul mesin tidak ditemukan di sistem.");
    }

    const namaMesinAsli = masterRecord[0].namaGroupMesin;
    const namaGroupMesin = body.namaGroupMesin || namaMesinAsli;

    // 2. Update cabangId, espId, namaGroupMesin di master
    await connection.execute(
      `UPDATE tbl_mesin_master SET cabangId = ?, espId = ?, namaGroupMesin = ?, updatedBy = ?, updatedDate = CURRENT_TIMESTAMP WHERE id = ?`,
      [cabangId, espId, namaGroupMesin, updatedBy, idMesinMaster]
    );

    // 3. Fungsi Internal untuk Sinkronisasi (Upsert / Delete)
    const syncMesin = async (jenis, isAktif, channelPin) => {
      let currentId = null;

      if (isAktif === 1) {
        // Cek apakah data spesifik (WASHER/DRYER) ini sudah ada di tabel detail
        const [cekMesin] = await connection.execute(
          `SELECT id FROM tbl_mesin_detail WHERE idMesinMaster = ? AND jenisMesin = ?`,
          [idMesinMaster, jenis]
        );

        if (cekMesin.length > 0) {
          currentId = cekMesin[0].id;
        } else {
          // KONDISI B: Detail belum ada -> Lakukan INSERT
          const [result] = await connection.execute(
            `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, channelRelay, status) VALUES (?, ?, ?, 'READY')`,
            [idMesinMaster, jenis, channelPin]
          );
          currentId = result.insertId;
        }
      } else {
        // KONDISI C: Jika payload = 0 -> Lakukan DELETE dari tabel detail
        await connection.execute(
          `DELETE FROM tbl_mesin_detail WHERE idMesinMaster = ? AND jenisMesin = ?`,
          [idMesinMaster, jenis]
        );
      }
      return currentId;
    };

    // 4. Eksekusi Sinkronisasi untuk Washer (Pin 5) dan Dryer (Pin 4)
    const idWasher = await syncMesin('WASHER', washer, 5);
    const idDryer = await syncMesin('DRYER', dryer, 4);

    // Selesai, simpan permanen
    await connection.commit();

    return {
      idMitra,
      cabangId,
      namaGroupMesin,
      espId,
      washer: washer === 1 ? { id: idWasher, status: "Ready" } : null,
      dryer: dryer === 1 ? { id: idDryer, status: "Ready" } : null,
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
      `SELECT d.id, d.status, m.id AS masterId 
       FROM tbl_mesin_detail d
       JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
       WHERE d.id = ? AND m.statusAktif = 1`,
      [id]
    );

    if (existingMesin.length === 0) {
      throw new Error("data not found");
    }

    // 2. Tolak jika mesin sedang menyala (status = in_use)
    if (existingMesin[0].status === "IN_USE" || existingMesin[0].status === "in_use") {
      throw new Error("Mesin sedang menyala");
    }

    // 3. Soft delete: update statusAktif menjadi 0 dan update updatedBy pada master
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_mesin_master SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";

    const [result] = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, existingMesin[0].masterId]);

    return result;
  } catch (error) {
    throw error;
  }
};

const getMesinById = async (id) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        m.idMitra, 
        m.cabangId, 
        m.espId, 
        d.jenisMesin
       FROM tbl_mesin_master m
       LEFT JOIN tbl_mesin_detail d ON d.idMesinMaster = m.id
       WHERE m.id = ? AND m.statusAktif = 1`,
      [id]
    );

    if (rows.length === 0) {
      throw new Error("data not found");
    }

    let hasWasher = 0;
    let hasDryer = 0;

    rows.forEach(row => {
      if (row.jenisMesin === 'WASHER') hasWasher = 1;
      if (row.jenisMesin === 'DRYER') hasDryer = 1;
    });

    return {
      idMitra: rows[0].idMitra,
      cabangId: rows[0].cabangId,
      espId: rows[0].espId,
      washer: hasWasher,
      dryer: hasDryer
    };
  } catch (error) {
    throw error;
  }
};

const getAllMesin = async (status) => {
  try {
    let SQLQuery = `
      SELECT 
        d.id, d.jenisMesin AS tipeMesin, d.channelRelay, d.status, d.waktuSelesai, d.waktuPingTerakhir,
        m.id AS masterId, m.idMitra, m.cabangId, m.espId, m.namaGroupMesin AS namaMesin, m.statusAktif,
        mitra.namaMitra, cabang.namaCabang 
      FROM tbl_mesin_detail d
      JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
      LEFT JOIN tbl_mitra mitra ON m.idMitra = mitra.id 
      LEFT JOIN tbl_cabang cabang ON m.cabangId = cabang.id
    `;

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
    const [rows] = await dbPool.execute(
      `SELECT 
        m.id AS masterId,
        m.espId,
        m.namaGroupMesin,
        d.id AS detailId,
        d.jenisMesin,
        d.status,
        d.waktuSelesai
       FROM tbl_mesin_master m
       LEFT JOIN tbl_mesin_detail d ON d.idMesinMaster = m.id
       WHERE m.idMitra = ? AND m.statusAktif = 1
       ORDER BY m.id ASC`,
      [idMitra]
    );

    const groupedData = {};
    let nomorUrut = 1;

    rows.forEach((row) => {
      if (!groupedData[row.espId]) {
        groupedData[row.espId] = {
          nomorUrut: String(nomorUrut).padStart(2, '0'),
          espId: row.espId,
          namaGroupMesin: row.namaGroupMesin,
          washer: null,
          dryer: null,
        };
        nomorUrut++;
      }

      if (row.detailId) {
        const detailMesin = {
          idDb: row.detailId,
          status: row.status,
          waktuSelesai: row.status === 'IN_USE' ? row.waktuSelesai : null,
        };

        if (row.jenisMesin === 'WASHER') {
          groupedData[row.espId].washer = detailMesin;
        } else if (row.jenisMesin === 'DRYER') {
          groupedData[row.espId].dryer = detailMesin;
        }
      }
    });

    return Object.values(groupedData);
  } catch (error) {
    throw error;
  }
};

const getMesinByIdCabang = async (cabangId) => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        m.id AS masterId,
        m.espId,
        m.namaGroupMesin,
        d.id AS detailId,
        d.jenisMesin,
        d.status,
        d.waktuSelesai
       FROM tbl_mesin_master m
       LEFT JOIN tbl_mesin_detail d ON d.idMesinMaster = m.id
       WHERE m.cabangId = ? AND m.statusAktif = 1
       ORDER BY m.id ASC`,
      [cabangId]
    );

    const groupedData = {};
    let nomorUrut = 1;

    rows.forEach((row) => {
      if (!groupedData[row.espId]) {
        groupedData[row.espId] = {
          nomorUrut: String(nomorUrut).padStart(2, '0'),
          espId: row.espId,
          namaGroupMesin: row.namaGroupMesin,
          washer: null,
          dryer: null,
        };
        nomorUrut++;
      }

      if (row.detailId) {
        const detailMesin = {
          idDb: row.detailId,
          status: row.status,
          waktuSelesai: row.status === 'IN_USE' ? row.waktuSelesai : null,
        };

        if (row.jenisMesin === 'WASHER') {
          groupedData[row.espId].washer = detailMesin;
        } else if (row.jenisMesin === 'DRYER') {
          groupedData[row.espId].dryer = detailMesin;
        }
      }
    });

    return Object.values(groupedData);
  } catch (error) {
    throw error;
  }
};

const restoreMesin = async (id, updatedBy) => {
  try {
    // Check if mesin exists and is currently inactive
    const [existingMesin] = await dbPool.execute(
      `SELECT d.id, m.id AS masterId
       FROM tbl_mesin_detail d
       JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
       WHERE d.id = ? AND m.statusAktif = 0`,
      [id]
    );
    if (existingMesin.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Execute UPDATE query to set statusAktif back to 1 (true)
    const SQLQuery = "UPDATE tbl_mesin_master SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    const result = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, existingMesin[0].masterId]);

    return result;
  } catch (error) {
    throw error;
  }
};

const getMesinByEspId = async (espId) => {
  try {
    const [mesins] = await dbPool.execute(
      `SELECT 
        d.id, d.jenisMesin AS tipeMesin, d.channelRelay, d.status, d.waktuSelesai, d.waktuPingTerakhir,
        m.id AS masterId, m.idMitra, m.cabangId, m.espId, m.namaGroupMesin AS namaMesin, m.statusAktif
       FROM tbl_mesin_detail d
       JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
       WHERE m.espId = ? AND m.statusAktif = TRUE`,
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
      `SELECT 
        m.id AS masterId,
        m.espId,
        m.namaGroupMesin,
        d.id AS detailId,
        d.jenisMesin,
        d.status,
        d.waktuSelesai
      FROM tbl_mesin_master m
      LEFT JOIN tbl_mesin_detail d ON d.idMesinMaster = m.id
      WHERE m.cabangId = ? 
        AND m.idMitra = ?
        AND m.statusAktif = TRUE
      ORDER BY m.id ASC`,
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
          espId: row.espId,
          namaGroupMesin: row.namaGroupMesin,
          washer: null,
          dryer: null,
        };
        nomorUrut++;
      }

      // Masukkan data spesifik Washer / Dryer ke dalam "Kartu" tersebut
      if (row.detailId) {
        const detailMesin = {
          idDb: row.detailId,
          status: row.status,
          waktuSelesai: row.status === 'IN_USE' ? row.waktuSelesai : null,
        };

        if (row.jenisMesin === 'WASHER') {
          groupedData[row.espId].washer = detailMesin;
        } else if (row.jenisMesin === 'DRYER') {
          groupedData[row.espId].dryer = detailMesin;
        }
      }
    });

    // Ubah objek (dictionary) kembali menjadi Array
    return Object.values(groupedData);
  } catch (error) {
    throw error;
  }
};

const getAllMasterMesin = async () => {
  try {
    const [rows] = await dbPool.execute(
      `SELECT 
        m.id,
        m.espId,
        m.namaGroupMesin,
        d.id AS detailId,
        d.jenisMesin,
        d.status
       FROM tbl_mesin_master m
       LEFT JOIN tbl_mesin_detail d ON d.idMesinMaster = m.id
       WHERE m.statusAktif = 1
       ORDER BY m.id ASC`
    );

    if (rows.length === 0) {
      throw new Error("Data not found");
    }

    // Grup berdasarkan id master
    const groupedData = {};

    rows.forEach((row) => {
      if (!groupedData[row.id]) {
        groupedData[row.id] = {
          id: String(row.id),
          espId: row.espId,
          namaGroupMesin: row.namaGroupMesin,
          washer: null,
          dryer: null,
        };
      }

      if (row.detailId) {
        const detailMesin = {
          idDb: row.detailId,
          status: row.status,
        };

        if (row.jenisMesin === 'WASHER') {
          groupedData[row.id].washer = detailMesin;
        } else if (row.jenisMesin === 'DRYER') {
          groupedData[row.id].dryer = detailMesin;
        }
      }
    });

    return Object.values(groupedData);
  } catch (error) {
    throw error;
  }
};

const setMaintenance = async (idMesinDetail, updatedBy) => {
  try {
    // Cek apakah mesin detail eksis dan aktif (via master)
    const [existingDetail] = await dbPool.execute(
      `SELECT d.id, d.jenisMesin, d.status 
       FROM tbl_mesin_detail d
       JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
       WHERE d.id = ? AND m.statusAktif = 1`,
      [idMesinDetail]
    );

    if (existingDetail.length === 0) {
      throw new Error("data not found");
    }

    // Update status menjadi OFFLINE
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    await dbPool.execute(
      `UPDATE tbl_mesin_detail SET status = 'OFFLINE' WHERE id = ?`,
      [idMesinDetail]
    );

    return {
      id: String(idMesinDetail),
      jenisMesin: existingDetail[0].jenisMesin,
      status: "OFFLINE",
    };
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
  getAllMasterMesin,
  getMesinByIdMitra,
  getMesinByIdCabang,
  getMesinByEspId,
  getListMesinMobile,
  setMaintenance,
};
