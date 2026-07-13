const UsersModel = require("../models/users");
const bcrypt = require("bcrypt"); // Ensure bcrypt is installed
const { generateToken } = require("../utils/jwt");
const { sendResetPasswordEmail } = require("../utils/email");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");

const getAllUsers = async (req, res) => {
  const { status } = req.query;
  try {
    const [data] = await UsersModel.getAllUser(status);
    const mappedData = data.map((data) => ({
      id: data.id,
      nama: data.nama,
      idRole: data.roleId,
      namaRole: data.namaRole,
      username: data.username,
      statusAktif: data.statusAktif,
    }));
    res.json({
      message: "GET all Master User success",
      data: mappedData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params;
  // console.log(id);
  try {
    const [data] = await UsersModel.getUserById(id);
    const dataResult = data[0];

    if (!dataResult) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const mappedData = {
      id: dataResult.id,
      nama: dataResult.nama,
      idRole: dataResult.roleId,
      namaRole: dataResult.namaRole,
      username: dataResult.username,
      statusAktif: dataResult.statusAktif,
    };
    // console.log(mappedData);
    res.json({
      message: "Get by Id User success",
      data: mappedData,
    });
  } catch (error) {
    console.error("Error fetching Users:", error);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

const createNewUser = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");
  const missingFields = getMissingRequiredFields(body, ["nama", "username", "password", "roleId", "createdBy"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    const data = await UsersModel.createNewUser(body);
    res.status(201).json({
      message: "CREATE new User success",
      data: data,
    });
  } catch (error) {
    if (error.message === "User sudah terdaftar") {
      return res.status(400).json({
        error: error.message,
      });
    }

    console.error("Failed to create new user:", error.message);
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const loginUser = async (req, res) => {
  const { username, password } = req.body;
  try {
    const [user] = await UsersModel.validateUser(username);
    if (user.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const [dataUser_] = await UsersModel.identitiyUser(username);
    if (dataUser_.length === 0) {
      return res.status(401).json({ message: "user belum mempunyai role" });
    }

    const dataUser = dataUser_[0];
    // console.log(dataUser);
    const token = generateToken(dataUser);

    res.json({
      message: "Login successful",
      data: {
        id: dataUser.id_user,
        username: dataUser.username,
        nama: dataUser.nama,
        role: dataUser.namaRole,
        statusAktif: dataUser.statusAktif,
        token: token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server Error", serverMessage: error });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const body = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");
  const missingFields = getMissingRequiredFields(body, ["nama", "username", "roleId", "updatedBy"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    await UsersModel.updateUser(body, id);
    res.json({
      message: "UPDATE Users success",
      data: {
        id: id,
        ...body,
        statusAktif: true,
      },
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }

    if (error.message === "User sudah terdaftar") {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;
  try {
    await UsersModel.deleteUser(id, username);
    res.json({
      message: "DELETE Users success",
      data: null,
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const restoreUser = async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;
  try {
    await UsersModel.restoreUser(id, username);
    res.json({
      message: "RESTORE Users success",
      data: null,
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const changePassword = async (req, res) => {
  const { id } = req.params;
  const { body } = req;
  const username = req.user.username;

  // 1. Validasi required fields
  const requiredFields = ["oldPassword", "newPassword", "ConfirmNewPassword"];
  const missingFields = requiredFields.filter((field) => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  // 2. Validasi ConfirmNewPassword harus sama dengan newPassword
  if (body.newPassword !== body.ConfirmNewPassword) {
    return res.status(400).json({
      error: "Konfirmasi password baru tidak cocok",
    });
  }

  try {
    const resultUsername = await UsersModel.changePassword(id, body, username);

    res.json({
      message: "Password changed successfully",
      data: {
        username: resultUsername,
      },
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }

    if (error.message === "Password lama salah") {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const resetPassword = async (req, res) => {
  const { email } = req.params;

  try {
    const result = await UsersModel.resetPassword(email);

    // Kirim email link reset password ke user
    try {
      await sendResetPasswordEmail({
        to: result.email,
        username: result.username,
        role: "backoffice",
      });
    } catch (emailError) {
      console.error("Gagal mengirim email reset password backoffice:", emailError.message);
    }

    // Hapus email dari result sebelum dikirim dalam response data
    delete result.email;

    res.status(200).json({
      message: "Send Link Reset Password Successfully",
      data: result,
    });
  } catch (error) {
    if (error.message === "Email tidak ditemukan") {
      return res.status(404).json({
        error: error.message,
      });
    }
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createNewUser,
  updateUser,
  deleteUser,
    restoreUser,
  loginUser,
  changePassword,
  resetPassword,
};
