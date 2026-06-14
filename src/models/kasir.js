const dbPool = require("../config/database");
const bcrypt = require("bcrypt");
const { generateAndHashPassword } = require("../utils/password");

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
      throw new Error("Format email tidak valid");
    }

    // 1. Validasi Mitra Exist
    const [existingMitra] = await dbPool.execute(
      "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = TRUE",
      [idMitra]
    );
    if (existingMitra.length === 0) {
      throw new Error("Mitra tidak ditemukan atau tidak aktif");
    }

    // 1b. Validasi Cabang (milik idMitra yang sama)
    if (cabangId) {
      const [existingCabang] = await dbPool.execute(
        "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = TRUE",
        [cabangId, idMitra]
      );
      if (existingCabang.length === 0) {
        throw new Error("Cabang tidak ditemukan atau tidak sesuai dengan Mitra");
      }
    }

    // 2. Validasi Duplikasi: username, email, atau noTelp
    const [duplicates] = await dbPool.execute(
      "SELECT username, email, noTelp FROM tbl_users_mobile WHERE username = ? OR email = ? OR noTelp = ?",
      [username, email, noTelp]
    );

    if (duplicates.length > 0) {
      if (duplicates.some((u) => u.username === username)) throw new Error("Username sudah terdaftar");
      if (duplicates.some((u) => u.email === email)) throw new Error("Email sudah terdaftar");
      if (duplicates.some((u) => u.noTelp === noTelp)) throw new Error("Nomor Telepon sudah terdaftar");
    }

    // 3. Generate Random Password & Hash
    console.log("Before generateAndHashPassword");
    const { password, hashedPassword } = await generateAndHashPassword(8);
    console.log("After generateAndHashPassword");

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

const getAllUserKasir = async (status) => {
  try {
    let SQLQuery = "SELECT * FROM tbl_users_mobile WHERE role = 'kasir'";
    let conditions = [];
    let values = [];

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

const getUserKasirById = async (id) => {
  try {
    const [user] = await dbPool.execute(
      "SELECT * FROM tbl_users_mobile WHERE id = ? AND role = 'kasir'",
      [id]
    );
    if (user.length === 0) throw new Error("data not found");
    delete user[0].password;
    delete user[0].deviceId;
    delete user[0].deviceName;
    return user[0];
  } catch (error) {
    throw error;
  }
};

const updateUserKasir = async (id, body) => {
  try {
    const { namaLengkap, noTelp, email, cabangId, updatedBy } = body;

    // 0. Validasi Format Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Format email tidak valid");
    }

    // 1. Cek eksistensi
    const [existing] = await dbPool.execute(
      "SELECT * FROM tbl_users_mobile WHERE id = ? AND role = 'kasir'",
      [id]
    );
    if (existing.length === 0) throw new Error("data not found");

    // 2. Validasi duplikasi jika data unik diubah
    const [duplicates] = await dbPool.execute(
      "SELECT email, noTelp FROM tbl_users_mobile WHERE (email = ? OR noTelp = ?) AND id != ?",
      [email, noTelp, id]
    );
    if (duplicates.length > 0) {
      if (duplicates.some((u) => u.email === email)) throw new Error("Email sudah terdaftar");
      if (duplicates.some((u) => u.noTelp === noTelp)) throw new Error("Nomor Telepon sudah terdaftar");
    }

    // 2b. Validasi Cabang (jika diisi)
    if (cabangId) {
      const [existingCabang] = await dbPool.execute(
        "SELECT id FROM tbl_cabang WHERE id = ? AND idMitra = ? AND statusAktif = TRUE",
        [cabangId, existing[0].idMitra]
      );
      if (existingCabang.length === 0) {
        throw new Error("Cabang tidak ditemukan atau tidak sesuai dengan Mitra");
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
      "SELECT * FROM tbl_users_mobile WHERE id = ?",
      [id]
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

const deleteUserKasir = async (id, updatedBy) => {
  try {
    const [existing] = await dbPool.execute(
      "SELECT id FROM tbl_users_mobile WHERE id = ? AND role = 'kasir' AND statusAktif = 1",
      [id]
    );
    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_users_mobile SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    return await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

const restoreUserKasir = async (id, updatedBy) => {
  try {
    const [existing] = await dbPool.execute(
      "SELECT id FROM tbl_users_mobile WHERE id = ? AND role = 'kasir' AND statusAktif = 0",
      [id]
    );
    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_users_mobile SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    return await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

const resetDeviceId = async (id, body, updatedBy) => {
  try {
    // 1. Validasi eksistensi berdasarkan id dan mitra
    const [existing] = await dbPool.execute(
      "SELECT username FROM tbl_users_mobile WHERE id = ? AND role = 'kasir' AND statusAktif = 1",
      [id]
    );

    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_users_mobile SET deviceId = NULL, deviceName = NULL, updatedBy = ?, updatedDate = ? WHERE id = ?";

    await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
    return existing[0].username;
  } catch (error) {
    throw error;
  }
};

const changePassword = async (id, body, updatedBy) => {
  try {
    const { oldPassword, newPassword } = body;

    // 1. Ambil data user termasuk password hashed
    const [rows] = await dbPool.execute(
      "SELECT username, password FROM tbl_users_mobile WHERE id = ? AND role = 'kasir' AND statusAktif = 1",
      [id]
    );

    if (rows.length === 0) throw new Error("data not found");

    const user = rows[0];

    // 2. Verifikasi password lama
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new Error("Password lama salah");
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

    if (rows.length === 0) throw new Error("data not found");

    return { username: rows[0].username, email: rows[0].email };
  } catch (error) {
    throw error;
  }
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
};
