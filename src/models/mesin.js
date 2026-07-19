const dbPool = require("../config/database");
const { withTransaction } = require("../utils/transaction");
const { createHttpError } = require("../utils/httpError");
const { MACHINE_STATUSES } = require("../domain/mesin");

const createNewMesin = async (body, createdBy = null) => {
  const { idMitra, cabangId, espId, washer, dryer } = body;
  return withTransaction(async (connection) => {

    // 1. Validasi Mitra Exist
    const [existingMitra] = await connection.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw createHttpError(400, "Mitra tidak ditemukan atau tidak aktif", "MESIN_MITRA_INVALID");
    }

    // 2. Validasi Cabang Exist dan sesuai dengan Mitra
    const [existingCabang] = await connection.execute(
      "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = TRUE",
      [cabangId, idMitra]
    );
    if (existingCabang.length === 0) {
      throw createHttpError(400, "Cabang tidak ditemukan / tidak aktif / tidak sesuai dengan Mitra", "MESIN_CABANG_INVALID");
    }

    // 3. Validasi duplikasi espId + cabangId
    const [existingMaster] = await connection.execute(
      "SELECT id FROM tbl_mesin_master WHERE espId = ? AND cabangId = ?",
      [espId, cabangId]
    );
    if (existingMaster.length > 0) {
      throw createHttpError(400, "Modul ESP ini sudah terdaftar di cabang yang sama", "MESIN_ESP_DUPLICATE");
    }

    // 4. Validasi minimal washer atau dryer
    if (washer !== 1 && dryer !== 1) {
      throw createHttpError(400, "Minimal salah satu washer atau dryer harus bernilai 1", "MESIN_TYPE_REQUIRED");
    }

    // 5. Hitung jumlah modul (espId unik) yang sudah ada di cabang tersebut
    const [countResult] = await connection.query(
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
    const [masterResult] = await connection.execute(
      `INSERT INTO tbl_mesin_master (idMitra, cabangId, espId, namaGroupMesin, createdBy) 
       VALUES (?, ?, ?, ?, ?)`,
      [idMitra, cabangId, espId, namaGroupMesinOtomatis, createdBy]
    );
    const idMesinMaster = masterResult.insertId;

    // 8. Insert Washer jika ada
    let washerResult = null;
    if (washer === 1) {
      const [detailWasher] = await connection.execute(
        `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, status) 
         VALUES (?, 'WASHER', ?)`,
        [idMesinMaster, MACHINE_STATUSES.READY]
      );
      washerResult = { id: detailWasher.insertId, status: "Ready" };
    }

    // 9. Insert Dryer jika ada
    let dryerResult = null;
    if (dryer === 1) {
      const [detailDryer] = await connection.execute(
        `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, status) 
         VALUES (?, 'DRYER', ?)`,
        [idMesinMaster, MACHINE_STATUSES.READY]
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
  });
};

const updateMesin = async (idMesinMaster, body, updatedBy) => {
  const { idMitra, cabangId, espId, washer, dryer } = body;

  return withTransaction(async (connection) => {
    // 1. Dapatkan master ID dan namaGroupMesin bawaan dari database
    const [masterRecord] = await connection.execute(
      `SELECT id, namaGroupMesin FROM tbl_mesin_master WHERE id = ? AND idMitra = ? AND statusAktif = 1 LIMIT 1`,
      [idMesinMaster, idMitra]
    );

    if (masterRecord.length === 0) {
      throw createHttpError(404, "Modul mesin tidak ditemukan di sistem.", "MESIN_MODULE_NOT_FOUND");
    }

    const namaMesinAsli = masterRecord[0].namaGroupMesin;
    const namaGroupMesin = body.namaGroupMesin || namaMesinAsli;

    // 2. Update cabangId, espId, namaGroupMesin di master
    await connection.execute(
      `UPDATE tbl_mesin_master SET cabangId = ?, espId = ?, namaGroupMesin = ?, updatedBy = ?, updatedDate = UTC_TIMESTAMP() WHERE id = ?`,
      [cabangId, espId, namaGroupMesin, updatedBy, idMesinMaster]
    );

    // 3. Fungsi Internal untuk Sinkronisasi (Upsert / Delete)
    const syncMesin = async (jenis, isAktif) => {
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
            `INSERT INTO tbl_mesin_detail (idMesinMaster, jenisMesin, status) VALUES (?, ?, ?)`,
            [idMesinMaster, jenis, MACHINE_STATUSES.READY]
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

    // 4. Eksekusi Sinkronisasi untuk Washer dan Dryer
    const idWasher = await syncMesin('WASHER', washer);
    const idDryer = await syncMesin('DRYER', dryer);

    return {
      idMitra,
      cabangId,
      namaGroupMesin,
      espId,
      washer: washer === 1 ? { id: idWasher, status: "Ready" } : null,
      dryer: dryer === 1 ? { id: idDryer, status: "Ready" } : null,
    };
  });
};

const deleteMesin = async (id, updatedBy) => {
    // 1. Cek apakah mesin eksis dan aktif
    const [existingMesin] = await dbPool.execute(
      `SELECT m.id AS masterId,
              EXISTS (
                SELECT 1
                FROM tbl_mesin_detail d
                WHERE d.idMesinMaster = m.id
                  AND UPPER(d.status) = ?
               ) AS isInUse
       FROM tbl_mesin_master m
       WHERE m.id = ? AND m.statusAktif = 1`,
      [MACHINE_STATUSES.IN_USE, id]
    );

    if (existingMesin.length === 0) {
      throw createHttpError(404, "data not found", "MESIN_NOT_FOUND");
    }

    // 2. Tolak jika mesin sedang menyala (status = in_use)
    if (existingMesin[0].isInUse) {
      throw createHttpError(400, "Mesin sedang menyala", "MESIN_RUNNING");
    }

    // 3. Soft delete: update statusAktif menjadi 0 dan update updatedBy pada master
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_mesin_master SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";

    const [result] = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, existingMesin[0].masterId]);

    return result;
};

const getMesinById = async (id) => {
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
      throw createHttpError(404, "data not found", "MESIN_NOT_FOUND");
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
};

const getAllMesin = async (status) => {
    let SQLQuery = `
      SELECT 
        d.id, d.jenisMesin AS tipeMesin, d.status, d.waktuPingTerakhir,
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
};

const getMesinByIdMitra = async (idMitra) => {
    const [rows] = await dbPool.execute(
      `SELECT 
        m.id AS masterId,
        m.espId,
        m.namaGroupMesin,
        d.id AS detailId,
        d.jenisMesin,
        d.status
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
          waktuSelesai: row.status === MACHINE_STATUSES.IN_USE ? row.waktuSelesai : null,
        };

        if (row.jenisMesin === 'WASHER') {
          groupedData[row.espId].washer = detailMesin;
        } else if (row.jenisMesin === 'DRYER') {
          groupedData[row.espId].dryer = detailMesin;
        }
      }
    });

    return Object.values(groupedData);
};

const getMesinByIdCabang = async (cabangId) => {
    const [rows] = await dbPool.execute(
      `SELECT 
        m.id AS masterId,
        m.espId,
        m.namaGroupMesin,
        d.id AS detailId,
        d.jenisMesin,
        d.status
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
          waktuSelesai: row.status === MACHINE_STATUSES.IN_USE ? row.waktuSelesai : null,
        };

        if (row.jenisMesin === 'WASHER') {
          groupedData[row.espId].washer = detailMesin;
        } else if (row.jenisMesin === 'DRYER') {
          groupedData[row.espId].dryer = detailMesin;
        }
      }
    });

    return Object.values(groupedData);
};

const restoreMesin = async (id, updatedBy) => {
    // Check if mesin exists and is currently inactive
    const [existingMesin] = await dbPool.execute(
      `SELECT m.id AS masterId
       FROM tbl_mesin_master m
       WHERE m.id = ? AND m.statusAktif = 0`,
      [id]
    );
    if (existingMesin.length === 0) {
      throw createHttpError(404, "data not found", "MESIN_NOT_FOUND");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Execute UPDATE query to set statusAktif back to 1 (true)
    const SQLQuery = "UPDATE tbl_mesin_master SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    const result = await dbPool.execute(SQLQuery, [updatedBy, updatedDate, existingMesin[0].masterId]);

    return result;
};

const getMesinByEspId = async (espId) => {
    const [mesins] = await dbPool.execute(
      `SELECT 
        d.id, d.jenisMesin AS tipeMesin, d.status, d.waktuSelesai, d.waktuPingTerakhir,
        m.id AS masterId, m.idMitra, m.cabangId, m.espId, m.namaGroupMesin AS namaMesin, m.statusAktif
       FROM tbl_mesin_detail d
       JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
       WHERE m.espId = ? AND m.statusAktif = TRUE`,
      [espId]
    );
    if (mesins.length === 0) {
      throw createHttpError(404, "Data not found", "MESIN_NOT_FOUND");
    }

    // Map ke format response: washer dan dryer sebagai 1 (ada) atau 0 (tidak ada)
    let hasWasher = 0;
    let hasDryer = 0;
    let masterId = null;
    let idMitra = null;
    let cabangId = null;

    for (const item of mesins) {
      masterId = item.masterId;
      idMitra = item.idMitra;
      cabangId = item.cabangId;
      if (item.tipeMesin === 'WASHER') {
        hasWasher = 1;
      } else if (item.tipeMesin === 'DRYER') {
        hasDryer = 1;
      }
    }

    return {
      masterId,
      idMitra,
      cabangId,
      espId,
      washer: hasWasher,
      dryer: hasDryer,
    };
};

const getListMesinMobile = async (cabangId, idMitra, filter) => {
    const normalizedFilter = filter ? String(filter).toLowerCase() : null;

    const [rows] = await dbPool.execute(
      `SELECT 
        m.id AS masterId,
        m.espId,
        m.namaGroupMesin,
        d.id AS detailId,
        d.jenisMesin,
        d.status
      FROM tbl_mesin_master m
      LEFT JOIN tbl_mesin_detail d ON d.idMesinMaster = m.id
      WHERE m.cabangId = ? 
        AND m.idMitra = ?
        AND m.statusAktif = TRUE
      ORDER BY m.id ASC`,
      [cabangId, idMitra]
    );

    if (rows.length === 0) {
      throw createHttpError(404, "Data not found", "MESIN_NOT_FOUND");
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
        const jenisMesin = row.jenisMesin ? row.jenisMesin.toLowerCase() : null;
        const detailMesin = {
          idDb: row.detailId,
          status: row.status,
          waktuSelesai: row.status === MACHINE_STATUSES.IN_USE ? row.waktuSelesai : null,
          enable: !normalizedFilter || normalizedFilter === jenisMesin ? 1 : 0,
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
};

const getMitraIdByCabangId = async (cabangId) => {
  const [rows] = await dbPool.execute(
    "SELECT idMitra FROM tbl_cabang WHERE id = ? LIMIT 1",
    [cabangId]
  );

  if (rows.length === 0) {
    throw createHttpError(404, "Data not found", "MESIN_NOT_FOUND");
  }

  return rows[0].idMitra;
};

const getAllMasterMesin = async () => {
    const [rows] = await dbPool.execute(
      `SELECT 
        m.id,
        m.espId,
        m.namaGroupMesin,
        d.id AS detailId,
        d.jenisMesin,
        d.status,
        mitra.namaMitra, cabang.namaCabang
       FROM tbl_mesin_master m
       LEFT JOIN tbl_mesin_detail d ON d.idMesinMaster = m.id
       LEFT JOIN tbl_mitra mitra ON m.idMitra = mitra.id 
      LEFT JOIN tbl_cabang cabang ON m.cabangId = cabang.id
       WHERE m.statusAktif = 1
       ORDER BY m.id ASC`
    );

    if (rows.length === 0) {
      throw createHttpError(404, "Data not found", "MESIN_NOT_FOUND");
    }

    // Grup berdasarkan id master
    const groupedData = {};

    rows.forEach((row) => {
      if (!groupedData[row.id]) {
        groupedData[row.id] = {
          id: String(row.id),
          namaMitra: row.namaMitra,
          namaCabang: row.namaCabang,
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
};

const setMaintenance = async (idMesinDetail, updatedBy) => {
    // Cek apakah mesin detail eksis dan aktif (via master)
    const [existingDetail] = await dbPool.execute(
      `SELECT d.id, d.jenisMesin, d.status FROM tbl_mesin_detail d
       JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
       WHERE d.id = ? AND m.statusAktif = 1`,
      [idMesinDetail]
    );

    if (existingDetail.length === 0) {
      throw createHttpError(404, "data not found", "MESIN_NOT_FOUND");
    }

    // Update status menjadi OFFLINE
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    await dbPool.execute(
      `UPDATE tbl_mesin_detail SET status = ? WHERE id = ?`,
      [MACHINE_STATUSES.OFFLINE, idMesinDetail]
    );

    return {
      id: String(idMesinDetail),
      jenisMesin: existingDetail[0].jenisMesin,
      status: MACHINE_STATUSES.OFFLINE,
    };
};

const setReady = async (idMesinDetail, updatedBy) => {
    // Cek apakah mesin detail eksis dan aktif (via master)
    const [existingDetail] = await dbPool.execute(
      `SELECT d.id, d.jenisMesin, d.status FROM tbl_mesin_detail d
       JOIN tbl_mesin_master m ON d.idMesinMaster = m.id
       WHERE d.id = ? AND m.statusAktif = 1`,
      [idMesinDetail]
    );

    if (existingDetail.length === 0) {
      throw createHttpError(404, "data not found", "MESIN_NOT_FOUND");
    }

    // Update status menjadi READY
    await dbPool.execute(
      `UPDATE tbl_mesin_detail SET status = ?, waktuSelesai = NULL WHERE id = ?`,
      [MACHINE_STATUSES.READY, idMesinDetail]
    );

    return {
      id: String(idMesinDetail),
      jenisMesin: existingDetail[0].jenisMesin,
      status: MACHINE_STATUSES.READY,
    };
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
  getMitraIdByCabangId,
  setMaintenance,
  setReady,
};
