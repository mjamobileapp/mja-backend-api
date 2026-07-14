const dbPool = require("../config/database");
const bcrypt = require("bcrypt");
const { createHttpError } = require("../utils/httpError");
const { generateAndHashPassword } = require("../utils/password");
const { getJakartaSqlDate, getJakartaSqlTime } = require("../utils/date");

const createNewUserKasir = async (body) => {
  try {
    const {
      username,
      idMitra,
      cabangId,
      namaLengkap,
      noTelp,
      email,
      createdBy,
    } = body;

    // 0. Validasi Format Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw createHttpError(400, "Format email tidak valid", "KASIR_EMAIL_INVALID");
    }

    // 1. Validasi Mitra Exist
    const [existingMitra] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw createHttpError(400, "Mitra tidak ditemukan atau tidak aktif", "KASIR_MITRA_INVALID");
    }

    // 1b. Validasi Cabang (milik idMitra yang sama)
    if (cabangId) {
      const [existingCabang] = await dbPool.execute(
        "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = TRUE",
        [cabangId, idMitra]
      );
      if (existingCabang.length === 0) {
      throw createHttpError(400, "Cabang tidak ditemukan atau tidak sesuai dengan Mitra", "KASIR_CABANG_INVALID");
      }
    }

    // 2. Validasi Duplikasi: username (global), email (aktif), atau noTelp (aktif)
    const [duplicates] = await dbPool.execute(
      `SELECT username, email, noTelp, statusAktif 
      FROM tbl_users_mobile 
      WHERE username = ? 
          OR ((email = ? OR noTelp = ?) AND statusAktif = 1)`,
      [username, email, noTelp]
    );

    if (duplicates.length > 0) {
      // if (duplicates.some((u) => u.username === username)) throw new Error("Username sudah terdaftar");
      // if (duplicates.some((u) => u.email === email)) throw new Error("Email sudah terdaftar");
      // if (duplicates.some((u) => u.noTelp === noTelp)) throw new Error("Nomor Telepon sudah terdaftar");

      // Cek duplikasi username (tidak peduli status aktif/nonaktif)
      if (duplicates.some((u) => u.username === username)) {
        throw createHttpError(400, "Username sudah terdaftar", "KASIR_USERNAME_DUPLICATE");
      }
      
      // Cek duplikasi email HANYA JIKA statusnya aktif
      if (duplicates.some((u) => u.email === email && u.statusAktif === 1)) {
        throw createHttpError(400, "Email sudah terdaftar dan sedang aktif digunakan", "KASIR_EMAIL_DUPLICATE");
      }
      
      // Cek duplikasi nomor telepon HANYA JIKA statusnya aktif
      if (duplicates.some((u) => u.noTelp === noTelp && u.statusAktif === 1)) {
        throw createHttpError(400, "Nomor Telepon sudah terdaftar dan sedang aktif digunakan", "KASIR_PHONE_DUPLICATE");
      }
    }

    // 3. Generate Random Password & Hash
    const { password, hashedPassword } = await generateAndHashPassword(8);

    // 4. Persiapkan timestamp
    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    // 5. Query INSERT
    const SQLQuery = `INSERT INTO tbl_users_mobile (
      username,
      password,
      role,
      idMitra,
      cabangId,
      namaLengkap,
      noTelp,
      email,
      createdBy,
      createdDate,
      statusAktif
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      username,
      hashedPassword,
      "kasir",
      idMitra,
      cabangId,
      namaLengkap,
      noTelp,
      email,
      createdBy,
      dateNow,
      true,
    ];

    await dbPool.execute(SQLQuery, values);

    // 6. Return data sesuai spesifikasi response success
    return {
      username,
      role: "kasir",
      idMitra,
      cabangId,
      namaLengkap,
      noTelp,
      email,
      password,
      createdBy,
      statusAktif: true,
    };
  } catch (error) {
    throw error;
  }
};

const getAllUserKasir = async (status, idMitra) => {
  try {
    let SQLQuery = "SELECT * FROM tbl_users_mobile WHERE role = 'kasir' AND idMitra = ?";
    let conditions = [];
    let values = [idMitra];

    if (status === "all") {
      // No status filter
    } else if (status === "inactive") {
      conditions.push("statusAktif = 0");
    } else {
      // Default: active
      conditions.push("statusAktif = 1");
    }

    if (conditions.length > 0) {
      SQLQuery += " AND " + conditions.join(" AND ");
    }

    const [users] = await dbPool.execute(SQLQuery, values);
    return users.map((user) => {
      delete user.password;
      delete user.deviceId;
      delete user.deviceName;
      return user;
    });
  } catch (error) {
    throw error;
  }
};

const getUserKasirById = async (id, idMitra) => {
  try {
    const [user] = await dbPool.execute(
      "SELECT * FROM tbl_users_mobile WHERE id = ? AND idMitra = ? AND role = 'kasir'",
      [id, idMitra]
    );
    if (user.length === 0) throw createHttpError(404, "data not found", "KASIR_NOT_FOUND");
    delete user[0].password;
    delete user[0].deviceId;
    delete user[0].deviceName;
    return user[0];
  } catch (error) {
    throw error;
  }
};

const updateUserKasir = async (id, body, idMitra) => {
  try {
    const { namaLengkap, noTelp, email, cabangId, updatedBy } = body;

    // 0. Validasi Format Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw createHttpError(400, "Format email tidak valid", "KASIR_EMAIL_INVALID");
    }

    // 1. Cek eksistensi
    const [existing] = await dbPool.execute(
      "SELECT * FROM tbl_users_mobile WHERE id = ? AND idMitra = ? AND role = 'kasir'",
      [id, idMitra]
    );
    if (existing.length === 0) throw createHttpError(404, "data not found", "KASIR_NOT_FOUND");

    // 2. Validasi duplikasi jika data unik diubah
    const [duplicates] = await dbPool.execute(
      "SELECT email, noTelp FROM tbl_users_mobile WHERE (email = ? OR noTelp = ?) AND id != ?",
      [email, noTelp, id]
    );
    if (duplicates.length > 0) {
      if (duplicates.some((u) => u.email === email)) throw createHttpError(400, "Email sudah terdaftar", "KASIR_EMAIL_DUPLICATE");
      if (duplicates.some((u) => u.noTelp === noTelp)) throw createHttpError(400, "Nomor Telepon sudah terdaftar", "KASIR_PHONE_DUPLICATE");
    }

    // 2b. Validasi Cabang (jika diisi)
    if (cabangId) {
      const [existingCabang] = await dbPool.execute(
        "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = TRUE",
        [cabangId, existing[0].idMitra]
      );
      if (existingCabang.length === 0) {
      throw createHttpError(400, "Cabang tidak ditemukan atau tidak sesuai dengan Mitra", "KASIR_CABANG_INVALID");
      }
    }

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = `UPDATE tbl_users_mobile SET 
      namaLengkap = ?, noTelp = ?, 
      email = ?, cabangId = COALESCE(?, cabangId),
      updatedBy = ?, updatedDate = ? 
      WHERE id = ?`;
    
    const values = [namaLengkap, noTelp, email, cabangId || null, updatedBy, updatedDate, id];
    await dbPool.execute(SQLQuery, values);

    // Ambil data terbaru dari database untuk dikembalikan sebagai response
    const [updatedUser] = await dbPool.execute(
      "SELECT * FROM tbl_users_mobile WHERE id = ? AND idMitra = ?",
      [id, idMitra]
    );
    const user = updatedUser[0];
    delete user.password;
    delete user.deviceId;
    delete user.deviceName;
    return user;
  } catch (error) {
    throw error;
  }
};

const deleteUserKasir = async (id, updatedBy, idMitra) => {
  try {
    const [existing] = await dbPool.execute(
      "SELECT id FROM tbl_users_mobile WHERE id = ? AND idMitra = ? AND role = 'kasir' AND statusAktif = 1",
      [id, idMitra]
    );
    if (existing.length === 0) throw createHttpError(404, "data not found", "KASIR_NOT_FOUND");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_users_mobile SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    return await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

const restoreUserKasir = async (id, updatedBy, idMitra) => {
  try {
    const [existing] = await dbPool.execute(
      "SELECT id FROM tbl_users_mobile WHERE id = ? AND idMitra = ? AND role = 'kasir' AND statusAktif = 0",
      [id, idMitra]
    );
    if (existing.length === 0) throw createHttpError(404, "data not found", "KASIR_NOT_FOUND");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_users_mobile SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    return await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

const resetDeviceId = async (id, body, updatedBy, idMitra) => {
  try {
    // 1. Validasi eksistensi berdasarkan id dan mitra
    const [existing] = await dbPool.execute(
      "SELECT username FROM tbl_users_mobile WHERE id = ? AND idMitra = ? AND role = 'kasir' AND statusAktif = 1",
      [id, idMitra]
    );

    if (existing.length === 0) throw createHttpError(404, "data not found", "KASIR_NOT_FOUND");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_users_mobile SET deviceId = NULL, deviceName = NULL, updatedBy = ?, updatedDate = ? WHERE id = ?";

    await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
    return existing[0].username;
  } catch (error) {
    throw error;
  }
};

const changePassword = async (id, body, updatedBy, idMitra) => {
  try {
    const { oldPassword, newPassword } = body;

    // 1. Ambil data user termasuk password hashed
    const [rows] = await dbPool.execute(
      "SELECT username, password FROM tbl_users_mobile WHERE id = ? AND idMitra = ? AND role = 'kasir' AND statusAktif = 1",
      [id, idMitra]
    );

    if (rows.length === 0) throw createHttpError(404, "data not found", "KASIR_NOT_FOUND");

    const user = rows[0];

    // 2. Verifikasi password lama
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw createHttpError(400, "Password lama salah", "KASIR_OLD_PASSWORD_INVALID");
    }

    // 3. Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // 4. Update password di database
    const SQLQuery = "UPDATE tbl_users_mobile SET password = ?, updatedBy = ?, updatedDate = ? WHERE id = ?";
    await dbPool.execute(SQLQuery, [hashedPassword, updatedBy, updatedDate, id]);

    return user.username;
  } catch (error) {
    throw error;
  }
};

const resetPassword = async (email) => {
  try {
    // 1. Validasi eksistensi email
    const [rows] = await dbPool.execute(
      "SELECT username, email FROM tbl_users_mobile WHERE email = ? AND role = 'kasir' AND statusAktif = 1",
      [email]
    );

    if (rows.length === 0) throw createHttpError(404, "data not found", "KASIR_NOT_FOUND");

    return { username: rows[0].username, email: rows[0].email };
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

const getAbsensiKasir = ({ cabangId, idMitra, tanggal, namaKasir }) => {
  let SQLQuery = `
    SELECT
      a.id AS absensiId,
      u.namaLengkap AS namaKasir,
      ${getJakartaSqlDate("a.waktuLogin")} AS tanggalShift,
      ${getJakartaSqlTime("a.waktuLogin")} AS jamMasuk,
      IF(a.waktuLogout IS NOT NULL, ${getJakartaSqlTime("a.waktuLogout")}, 'Belum') AS jamPulang
    FROM tbl_absensi a
    JOIN tbl_cabang c ON a.cabangId = c.id
    JOIN tbl_users_mobile u ON a.idUserMobile = u.id AND u.idMitra = c.idMitra
    WHERE a.cabangId = ? AND c.idMitra = ?
  `;
  const values = [cabangId, idMitra];

  if (tanggal) {
    SQLQuery += ` AND ${getJakartaSqlDate("a.waktuLogin")} = ?`;
    values.push(tanggal);
  }

  if (namaKasir) {
    SQLQuery += " AND u.namaLengkap LIKE ?";
    values.push(`%${namaKasir}%`);
  }

  SQLQuery += " ORDER BY a.waktuLogin DESC";

  return dbPool.execute(SQLQuery, values);
};

module.exports = {
  createNewUserKasir,
  getAllUserKasir,
  getUserKasirById,
  updateUserKasir,
  deleteUserKasir,
  restoreUserKasir,
  resetDeviceId,
  changePassword,
  resetPassword,
  isCabangOwnedByMitra,
  getAbsensiKasir,
};

