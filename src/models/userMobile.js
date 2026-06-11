const bcrypt = require("bcrypt");
const dbPool = require("../config/database");

const getUserByUsername = async (username) => {
  const [rows] = await dbPool.execute(
    "SELECT * FROM tbl_users_mobile WHERE username = ? AND statusAktif = true",
    [username]
  );
  return rows[0] || null;
};

const updateDeviceId = async (id, deviceId, deviceName) => {
  await dbPool.execute(
    "UPDATE tbl_users_mobile SET deviceId = ?, deviceName = ? WHERE id = ?",
    [deviceId, deviceName, id]
  );
};

const createAbsensi = async (idUserMobile, cabangId) => {
  const [result] = await dbPool.execute(
    "INSERT INTO tbl_absensi (idUserMobile, cabangId, waktuLogin) VALUES (?, ?, NOW())",
    [idUserMobile, cabangId]
  );
  return result;
};

const createNotifikasi = async (idMitra, cabangId, tipe, judul, pesan) => {
  const [result] = await dbPool.execute(
    "INSERT INTO tbl_notifikasi (idMitra, cabangId, tipe, judul, pesan) VALUES (?, ?, ?, ?, ?)",
    [idMitra, cabangId, tipe, judul, pesan]
  );
  return result;
};

const updateStatusAktifByUsername = async (username) => {
  try {
    const [result] = await dbPool.execute(
      "UPDATE tbl_users_mobile SET statusAktif = 1 WHERE username = ?",
      [username]
    );

    if (result.affectedRows === 0) {
      throw new Error("data not found");
    }

    return result;
  } catch (error) {
    throw error;
  }
};

const updatePasswordByUsername = async (username, hashedPassword) => {
  try {
    const [result] = await dbPool.execute(
      "UPDATE tbl_users_mobile SET password = ? WHERE username = ?",
      [hashedPassword, username]
    );

    if (result.affectedRows === 0) {
      throw new Error("data not found");
    }

    return result;
  } catch (error) {
    throw error;
  }
};

const getUserByUsernameWithoutStatusFilter = async (username) => {
  try {
    const [rows] = await dbPool.execute(
      "SELECT * FROM tbl_users_mobile WHERE username = ?",
      [username]
    );

    if (rows.length === 0) throw new Error("data not found");

    delete rows[0].password;
    delete rows[0].deviceId;
    delete rows[0].deviceName;
    return rows[0];
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getUserByUsername,
  updateDeviceId,
  createAbsensi,
  createNotifikasi,
  updateStatusAktifByUsername,
  updatePasswordByUsername,
  getUserByUsernameWithoutStatusFilter,
};
