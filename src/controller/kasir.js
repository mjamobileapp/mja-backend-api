const KasirModel = require("../models/kasir");
const EmailService = require("../utils/email");
const { sendResetPasswordAccepted } = require("../utils/publicAuth");
const { formatTanggalWIB } = require("../utils/date");
const { getMissingRequiredFields } = require("../utils/validation");

const createNewUserKasir = async (req, res) => {
  const { body } = req;
  const idMitra = req.user.idMitra;
  const usernameToken = req.user.username;

  // 1. Validasi field yang dibutuhkan di level controller
  const missingFields = getMissingRequiredFields(body, ["username", "cabangId", "namaLengkap", "noTelp", "email"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  if (!idMitra || !usernameToken) {
    return res.status(400).json({
      error: "idMitra atau username tidak ditemukan di token",
    });
  }

  try {
    // 2. Panggil Model untuk menyimpan data
    const result = await KasirModel.createNewUserKasir({
      ...body,
      idMitra,
      createdBy: usernameToken,
    });

    // 3. Kirim email kredensial ke user
    try {
      await EmailService.sendUserMobileCredentialEmail({
        to: result.email,
        username: result.username,
        role: "kasir",
      });
    } catch (emailError) {
      console.error("Gagal mengirim email create kasir:", emailError.message);
    }

    res.status(201).json({
      message: "CREATE new Kasir success",
      data: result,
    });
  } catch (error) {
    // 3. Handle error validasi spesifik (400 Bad Request)
    if (
      error.message === "Mitra tidak ditemukan atau tidak aktif" || 
      error.message === "Username sudah terdaftar" ||
      error.message === "Email sudah terdaftar dan sedang aktif digunakan" ||
      error.message === "Nomor Telepon sudah terdaftar dan sedang aktif digunakan" ||
      error.message === "Format email tidak valid" ||
      error.message === "Cabang tidak ditemukan atau tidak sesuai dengan Mitra"
    ) {
      return res.status(400).json({
        error: error.message,
      });
    }

    // 4. Handle Server Error (500)
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getAllUserKasir = async (req, res) => {
  const { status } = req.query;

  try {
    const data = await KasirModel.getAllUserKasir(status, req.user.idMitra);
    res.status(200).json({
      message: "Get All Kasir success",
      data: data,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const getUserKasirById = async (req, res) => {
  const { id } = req.params;

  try {
    const data = await KasirModel.getUserKasirById(id, req.user.idMitra);
    res.status(200).json({
      message: "Get Kasir by Id success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const updateUserKasir = async (req, res) => {
  const { id } = req.params;
  const { body } = req;
  const usernameToken = req.user.username;

  const missingFields = getMissingRequiredFields(body, ["namaLengkap", "noTelp", "email"]);

  if (missingFields.length > 0) {
    return res.status(400).json({ 
      message: "Bad request, missing required fields",
      missingFields: missingFields 
    });
  }

  try {
    const data = await KasirModel.updateUserKasir(id, { ...body, updatedBy: usernameToken }, req.user.idMitra);
    res.status(200).json({
      message: "UPDATE Kasir success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    if (
      error.message === "Username sudah terdaftar" ||
      error.message === "Email sudah terdaftar" ||
      error.message === "Nomor Telepon sudah terdaftar" ||
      error.message === "Format email tidak valid" ||
      error.message === "Cabang tidak ditemukan atau tidak sesuai dengan Mitra"
    ) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const deleteUserKasir = async (req, res) => {
  const { id } = req.params;
  const usernameToken = req.user.username;

  try {
    await KasirModel.deleteUserKasir(id, usernameToken, req.user.idMitra);
    res.status(200).json({
      message: "Delete Kasir success",
      data: null,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const restoreUserKasir = async (req, res) => {
  const { id } = req.params;
  const usernameToken = req.user.username;

  try {
    await KasirModel.restoreUserKasir(id, usernameToken, req.user.idMitra);
    res.status(200).json({
      message: "Restore Kasir success",
      data: null,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const resetDeviceId = async (req, res) => {
  const { id } = req.params;
  const { body } = req;
  const usernameToken = req.user.username;

  try {
    const username = await KasirModel.resetDeviceId(id, body, usernameToken, req.user.idMitra);
    res.status(200).json({
      message: "Reset Device ID success",
      data: {
        username: username,
      },
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: "Data Not Found",
      });
    }
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const changePassword = async (req, res) => {
  const { id } = req.params;
  const { body } = req;
  const usernameToken = req.user.username;

  // 1. Validasi field yang dibutuhkan
  const requiredPasswordFields = ['oldPassword', 'newPassword', 'ConfirmNewPassword'];
  const missingPasswordFields = requiredPasswordFields.filter(field => !body[field]);

  if (missingPasswordFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingPasswordFields,
    });
  }

  // 2. Validasi kecocokan password baru
  if (body.newPassword !== body.ConfirmNewPassword) {
    return res.status(400).json({
      error: "Password baru dan konfirmasi tidak cocok",
    });
  }

  try {
    const username = await KasirModel.changePassword(id, body, usernameToken, req.user.idMitra);
    res.status(200).json({
      message: "Password changed successfully",
      data: {
        username: username,
      },
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({ error: "Data Not Found" });
    }
    if (error.message === "Password lama salah") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const resetPassword = async (req, res) => {
  const { email } = req.params;

  try {
    const result = await KasirModel.resetPassword(email);

    // 2. Kirim email password baru ke user
    try {
      await EmailService.sendResetPasswordEmail({
        to: result.email,
        username: result.username,
        role: "kasir",
      });
    } catch (emailError) {
      console.error("Gagal mengirim email reset password:", emailError.message);
    }
  } catch (error) {
    console.error("Gagal memproses permintaan reset password kasir:", error.message);
  }

  return sendResetPasswordAccepted(res);
};

const getAbsensiKasir = async (req, res) => {
  const { tanggal, namaKasir } = req.query;
  const requestedCabangId = req.query.cabangId;
  const idMitra = req.user?.idMitra;
  const role = String(req.user?.role || "").toLowerCase();
  const tokenCabangId = req.user?.cabang_id || req.user?.cabangId;

  if (!idMitra) {
    return res.status(403).json({ error: "idMitra tidak ditemukan di token" });
  }

  try {
    let cabangId;

    if (role === "kasir") {
      if (!tokenCabangId) {
        return res.status(403).json({ error: "Cabang kasir tidak ditemukan di token" });
      }

      if (requestedCabangId && Number(requestedCabangId) !== Number(tokenCabangId)) {
        return res.status(403).json({ error: "Kasir hanya dapat mengakses absensi cabangnya sendiri" });
      }

      cabangId = tokenCabangId;
    } else if (role === "owner") {
      if (!requestedCabangId) {
        return res.status(400).json({ error: "Parameter cabangId diperlukan untuk owner" });
      }

      const isOwnedCabang = await KasirModel.isCabangOwnedByMitra(requestedCabangId, idMitra);
      if (!isOwnedCabang) {
        return res.status(403).json({ error: "Cabang tidak dapat diakses oleh user owner mitra ini" });
      }

      cabangId = requestedCabangId;
    } else {
      return res.status(403).json({ error: "Role tidak diizinkan mengakses absensi kasir" });
    }

    const [data] = await KasirModel.getAbsensiKasir({
      cabangId,
      idMitra,
      tanggal,
      namaKasir,
    });

    const mappedData = data.map((item) => ({
      id: item.absensiId,
      tanggalShift: formatTanggalWIB(item.tanggalShift),
      namaKasir: item.namaKasir,
      jamMasuk: item.jamMasuk,
      jamPulang: item.jamPulang,
    }));

    res.json({
      message: "Get Data Absensi Kasir Success",
      data: mappedData,
    });
  } catch (error) {
    console.error("Error fetching absensi kasir:", error);
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
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
  getAbsensiKasir,
};

