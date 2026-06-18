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

const updateMesin = async (id, body) => {
  try {
    const { namaMesin, tipeMesin, kapasitas, ipAddressEsp, macAddress, updatedBy } = body;

    // Check if mesin exists
    const [existingMesin] = await dbPool.execute(
      "SELECT namaMesin FROM tbl_mesin WHERE id = ?",
      [id]
    );
    if (existingMesin.length === 0) {
      throw new Error("data not found");
    }

    // Get current timestamp
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // Update the mesin data - only update available fields
    const SQLQuery = `UPDATE tbl_mesin SET
      namaMesin = ?,
      tipeMesin = ?,
      kapasitas = ?,
      ipAddressEsp = ?,
      macAddress = ?,
      updatedBy = ?,  
      updatedDate = ?    
      WHERE id = ?`;

    const values = [namaMesin, tipeMesin, kapasitas, ipAddressEsp, macAddress, updatedBy, updatedDate, id];

    await dbPool.execute(SQLQuery, values);

    // Fetch and return the updated mesin data
    const [updatedMesin] = await dbPool.execute(
      "SELECT m.*, mitra.namaMitra, cabang.namaCabang FROM tbl_mesin m LEFT JOIN tbl_mitra mitra ON m.idMitra = mitra.id LEFT JOIN tbl_cabang cabang ON m.cabangId = cabang.id WHERE m.id = ?",
      [id]
    );

    const result = updatedMesin[0];
    return result;
  } catch (error) {
    throw error;
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

module.exports = {
  createNewMesin,
  updateMesin,
  deleteMesin,
  restoreMesin,
  getMesinById,
  getAllMesin,
  getMesinByIdMitra,
  getMesinByIdCabang,
};
