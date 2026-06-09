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

module.exports = {
  getUserByUsername,
  updateDeviceId,
  createAbsensi,
  createNotifikasi,
};
