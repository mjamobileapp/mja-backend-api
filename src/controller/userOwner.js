const UserOwnerModel = require("../models/userOwner");
const { sendUserOwnerCredentialEmail, sendResetPasswordEmail } = require("../utils/email");

const createNewUserOwner = async (req, res) => {
  const { body } = req;

  // 1. Validasi field yang dibutuhkan di level controller
  const requiredFields = ['username', 'role', 'idMitra', 'namaLengkap', 'noTelp', 'email', 'createdBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    // 2. Panggil Model untuk menyimpan data
    const result = await UserOwnerModel.createNewUserOwner(body);

    // 3. Kirim email kredensial ke user
    try {
      await sendUserOwnerCredentialEmail({
        to: result.email,
        username: result.username,
      });
    } catch (emailError) {
      console.error("Gagal mengirim email create owner:", emailError.message);
    }

    res.status(201).json({
      message: "CREATE new User Owner success",
      data: result,
    });
  } catch (error) {
    // 3. Handle error validasi spesifik (400 Bad Request)
    if (
      error.message === "Mitra tidak ditemukan atau tidak aktif" || 
      error.message === "Username sudah terdaftar" ||
      error.message === "Email sudah terdaftar" ||
      error.message === "Nomor Telepon sudah terdaftar" ||
      error.message === "Format email tidak valid"
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

const getAllUserOwner = async (req, res) => {
  const { idMitra, status } = req.query;
  try {
    const data = await UserOwnerModel.getAllUserOwner(idMitra, status);
    res.status(200).json({
      message: "Get All User Owner success",
      data: data,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const getUserOwnerById = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await UserOwnerModel.getUserOwnerById(id);
    res.status(200).json({
      message: "Get User Owner by Id success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const updateUserOwner = async (req, res) => {
  const { id } = req.params;
  const { body } = req;

  const requiredFields = ['namaLengkap', 'noTelp', 'email', 'updatedBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({ 
      message: "Bad request, missing required fields",
      missingFields: missingFields 
    });
  }

  try {
    const data = await UserOwnerModel.updateUserOwner(id, body);
    res.status(200).json({
      message: "UPDATE User Owner success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    if (
      error.message === "Username sudah terdaftar" ||
      error.message === "Email sudah terdaftar" ||
      error.message === "Nomor Telepon sudah terdaftar" ||
      error.message === "Format email tidak valid"
    ) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const deleteUserOwner = async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;

  try {
    await UserOwnerModel.deleteUserOwner(id, username);
    res.status(200).json({
      message: "Delete User Owner success",
      data: null,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const restoreUserOwner = async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;

  try {
    await UserOwnerModel.restoreUserOwner(id, username);
    res.status(200).json({
      message: "Restore User Owner success",
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
    const username = await UserOwnerModel.resetDeviceId(id, body, usernameToken);
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
    const username = await UserOwnerModel.changePassword(id, body, usernameToken);
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
  const usernameToken = req.user.username;

  // 1. Validasi field username di body
  if (!body.username) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: ["username"],
    });
  }

  try {
    const result = await UserOwnerModel.resetPassword(id, body, usernameToken);

    // 3. Kirim email password baru ke user
    try {
      await sendResetPasswordEmail({
        to: result.email,
        username: result.username,
        // newPassword: result.newPassword, --- IGNORE ---
      });
    } catch (emailError) {
      console.error("Gagal mengirim email reset password:", emailError.message);
    }

    res.status(200).json({
      message: "Send Link Reset Password Successfully",
      data: result,
    });
  } catch (error) {
    // 2. Handle error spesifik
    if (error.message === "data not found") {
      return res.status(404).json({
        error: "Data Not Found",
      });
    }
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
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