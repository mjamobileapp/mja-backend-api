const KasirModel = require("../models/kasir");
const { sendUserMobileCredentialEmail, sendResetPasswordEmail } = require("../utils/email");

const createNewUserKasir = async (req, res) => {
  const { body } = req;
  const idMitra = req.user.idMitra;
  const usernameToken = req.user.username;

  // 1. Validasi field yang dibutuhkan di level controller
  const requiredFields = ['username', 'namaLengkap', 'noTelp', 'email', 'cabangId'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
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
      await sendUserMobileCredentialEmail({
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
      error.message === "Email sudah terdaftar" ||
      error.message === "Nomor Telepon sudah terdaftar" ||
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
  const idMitra = req.user.idMitra;
  const { status } = req.query;

  try {
    const data = await KasirModel.getAllUserKasir(idMitra, status);
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
  const idMitra = req.user.idMitra;

  try {
    const data = await KasirModel.getUserKasirById(id, idMitra);
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
  const idMitra = req.user.idMitra;
  const usernameToken = req.user.username;

  const requiredFields = ['namaLengkap', 'noTelp', 'email'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({ 
      message: "Bad request, missing required fields",
      missingFields: missingFields 
    });
  }

  try {
    const data = await KasirModel.updateUserKasir(id, { ...body, updatedBy: usernameToken }, idMitra);
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
  const idMitra = req.user.idMitra;
  const usernameToken = req.user.username;

  try {
    await KasirModel.deleteUserKasir(id, usernameToken, idMitra);
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
  const idMitra = req.user.idMitra;
  const usernameToken = req.user.username;

  try {
    await KasirModel.restoreUserKasir(id, usernameToken, idMitra);
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
  const idMitra = req.user.idMitra;
  const usernameToken = req.user.username;

  try {
    const username = await KasirModel.resetDeviceId(id, body, usernameToken, idMitra);
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
  const idMitra = req.user.idMitra;
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
    const username = await KasirModel.changePassword(id, body, usernameToken, idMitra);
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
  const { id } = req.params;
  const { body } = req;
  const idMitra = req.user.idMitra;
  const usernameToken = req.user.username;

  // 1. Validasi field username di body
  if (!body.username) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: ["username"],
    });
  }

  try {
    const result = await KasirModel.resetPassword(id, body, usernameToken, idMitra);

    // 2. Kirim email password baru ke user
    try {
      await sendResetPasswordEmail({
        to: result.email,
        username: result.username,
        role: "kasir",
      });
    } catch (emailError) {
      console.error("Gagal mengirim email reset password:", emailError.message);
    }

    res.status(200).json({
      message: "Send Link Reset Password Successfully",
      data: result,
    });
  } catch (error) {
    // 3. Handle error spesifik
    if (error.message === "data not found") {
      return res.status(404).json({
        error: "Data Not Found",
      });
    }
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
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
