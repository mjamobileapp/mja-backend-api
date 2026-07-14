const UsersModel = require("../models/users");
const bcrypt = require("bcrypt");
const { generateToken, TOKEN_TYPES } = require("../utils/jwt");
const EmailService = require("../utils/email");
const { sendResetPasswordAccepted } = require("../utils/publicAuth");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");

const getAllUsers = async (req, res) => {
  const [data] = await UsersModel.getAllUser(req.query.status);
  const mappedData = data.map((item) => ({ id: item.id, nama: item.nama, idRole: item.roleId, namaRole: item.namaRole, username: item.username, statusAktif: item.statusAktif }));
  return res.json({ message: "GET all Master User success", data: mappedData });
};

const getUserById = async (req, res) => {
  const [data] = await UsersModel.getUserById(req.params.id);
  if (!data[0]) return res.status(404).json({ message: "User not found" });
  const item = data[0];
  const mappedData = { id: item.id, nama: item.nama, idRole: item.roleId, namaRole: item.namaRole, username: item.username, statusAktif: item.statusAktif };
  return res.json({ message: "Get by Id User success", data: mappedData });
};

const createNewUser = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");
  const missingFields = getMissingRequiredFields(body, ["nama", "username", "password", "roleId", "createdBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const data = await UsersModel.createNewUser(body);
  return res.status(201).json({ message: "CREATE new User success", data });
};

const loginUser = async (req, res) => {
  const { username, password } = req.body;
  const [user] = await UsersModel.validateUser(username);
  if (user.length === 0) return res.status(401).json({ message: "Invalid username or password" });
  if (!await bcrypt.compare(password, user[0].password)) return res.status(401).json({ message: "Invalid username or password" });
  const [dataUser_] = await UsersModel.identitiyUser(username);
  if (dataUser_.length === 0) return res.status(401).json({ message: "user belum mempunyai role" });
  const dataUser = dataUser_[0];
  const token = generateToken(dataUser, TOKEN_TYPES.BACKOFFICE);
  return res.json({ message: "Login successful", data: { id: dataUser.id_user, username: dataUser.username, nama: dataUser.nama, role: dataUser.namaRole, statusAktif: dataUser.statusAktif, token } });
};

const updateUser = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");
  const missingFields = getMissingRequiredFields(body, ["nama", "username", "roleId", "updatedBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  await UsersModel.updateUser(body, req.params.id);
  return res.json({ message: "UPDATE Users success", data: { id: req.params.id, ...body, statusAktif: true } });
};

const deleteUser = async (req, res) => {
  await UsersModel.deleteUser(req.params.id, req.user.username);
  return res.json({ message: "DELETE Users success", data: null });
};

const restoreUser = async (req, res) => {
  await UsersModel.restoreUser(req.params.id, req.user.username);
  return res.json({ message: "RESTORE Users success", data: null });
};

const changePassword = async (req, res) => {
  const requiredFields = ["oldPassword", "newPassword", "ConfirmNewPassword"];
  const missingFields = requiredFields.filter((field) => !req.body[field]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  if (req.body.newPassword !== req.body.ConfirmNewPassword) return res.status(400).json({ error: "Konfirmasi password baru tidak cocok" });
  const resultUsername = await UsersModel.changePassword(req.params.id, req.body, req.user.username);
  return res.json({ message: "Password changed successfully", data: { username: resultUsername } });
};

const resetPassword = async (req, res) => {
  try {
    const result = await UsersModel.resetPassword(req.params.email);
    try {
      await EmailService.sendResetPasswordEmail({ to: result.email, username: result.username, role: "backoffice" });
    } catch (emailError) {
      console.error("Gagal mengirim email reset password backoffice:", emailError.message);
    }
  } catch (error) {
    console.error("Gagal memproses permintaan reset password backoffice:", error.message);
  }
  return sendResetPasswordAccepted(res);
};

module.exports = { getAllUsers, getUserById, createNewUser, updateUser, deleteUser, restoreUser, loginUser, changePassword, resetPassword };
