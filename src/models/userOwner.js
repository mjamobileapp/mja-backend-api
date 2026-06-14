const dbPool = require("../config/database");
const bcrypt = require("bcrypt");
const { generateAndHashPassword } = require("../utils/password");

const createNewUserOwner = async (body) => {
  try {
    const {
      username,
      role,
      idMitra,
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
    const { password, hashedPassword } = await generateAndHashPassword(8);

    // 4. Persiapkan timestamp
    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

    // 5. Query INSERT
    const SQLQuery = `INSERT INTO tbl_users_mobile (
      username,
      password,
      role,
      idMitra,
      namaLengkap,
      noTelp,
      email,
      createdBy,
      createdDate,
      statusAktif
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      username,
      hashedPassword,
      role,
      idMitra,
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
      role,
      idMitra,
      namaLengkap,
      noTelp,
      email,
      password, // Kembalikan password plain agar admin bisa menyampaikannya ke owner
      createdBy,
      statusAktif: true,
    };
  } catch (error) {
    throw error;
  }
};

const getAllUserOwner = async (idMitra, status) => {
  try {
    let SQLQuery = "SELECT * FROM tbl_users_mobile";
    let conditions = [];
    let values = [];

    if (idMitra) {
      conditions.push("idMitra = ?");
      values.push(idMitra);
    }

    if (status === "all") {
      // No status filter
    } else if (status === "inactive") {
      conditions.push("statusAktif = 0");
    } else {
      // Default: active
      conditions.push("statusAktif = 1");
    }

    if (conditions.length > 0) {
      SQLQuery += " WHERE " + conditions.join(" AND ");
    }

    const [users] = await dbPool.execute(SQLQuery, values);
    return users.map((user) => {
      delete user.password;
      delete user.cabangId;
      return user;
    });
  } catch (error) {
    throw error;
  }
};

const getUserOwnerById = async (id) => {
  try {
    const [user] = await dbPool.execute("SELECT * FROM tbl_users_mobile WHERE id = ?", [id]);
    if (user.length === 0) throw new Error("data not found");
    delete user[0].password;
    delete user[0].cabangId;
    return user[0];
  } catch (error) {
    throw error;
  }
};

const updateUserOwner = async (id, body) => {
  try {
    const { namaLengkap, noTelp, email, updatedBy } = body;

    // 0. Validasi Format Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Format email tidak valid");
    }

    // 1. Cek eksistensi
    const [existing] = await dbPool.execute("SELECT * FROM tbl_users_mobile WHERE id = ?", [id]);
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

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = `UPDATE tbl_users_mobile SET 
      namaLengkap = ?, noTelp = ?, 
      email = ?, updatedBy = ?, updatedDate = ? 
      WHERE id = ?`;
    
    const values = [namaLengkap, noTelp, email, updatedBy, updatedDate, id];
    await dbPool.execute(SQLQuery, values);

    // Ambil data terbaru dari database untuk dikembalikan sebagai response
    const [updatedUser] = await dbPool.execute("SELECT * FROM tbl_users_mobile WHERE id = ?", [id]);
    const user = updatedUser[0];
    delete user.password;
    delete user.cabangId;
    return user;
  } catch (error) {
    throw error;
  }
};

const deleteUserOwner = async (id, updatedBy) => {
  try {
    const [existing] = await dbPool.execute("SELECT id FROM tbl_users_mobile WHERE id = ? AND statusAktif = 1", [id]);
    if (existing.length === 0) throw new Error("data not found");

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_users_mobile SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    
    return await dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

const restoreUserOwner = async (id, updatedBy) => {
  try {
    const [existing] = await dbPool.execute("SELECT id FROM tbl_users_mobile WHERE id = ? AND statusAktif = 0", [id]);
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
    const { deviceId, deviceName } = body;

    // 1. Validasi eksistensi berdasarkan id dan device info yang lama
    const [existing] = await dbPool.execute(
      "SELECT username FROM tbl_users_mobile WHERE id = ? AND statusAktif = 1",
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
      "SELECT username, password FROM tbl_users_mobile WHERE id = ? AND statusAktif = 1",
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
      "SELECT username, email FROM tbl_users_mobile WHERE email = ? AND role = 'owner' AND statusAktif = 1",
      [email]
    );

    if (rows.length === 0) throw new Error("data not found");

    return { username: rows[0].username, email: rows[0].email};
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createNewUserOwner,
  getAllUserOwner,
  getUserOwnerById,
  updateUserOwner,
  deleteUserOwner,
  restoreUserOwner,
  resetDeviceId,
  changePassword,
  resetPassword,
};
