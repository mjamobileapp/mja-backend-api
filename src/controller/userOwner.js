const UserOwnerModel = require("../models/userOwner");
const EmailService = require("../utils/email");
const { sendResetPasswordAccepted } = require("../utils/publicAuth");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");

const createNewUserOwner = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");
  const missingFields = getMissingRequiredFields(body, ["username", "idMitra", "namaLengkap", "noTelp", "email", "createdBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const result = await UserOwnerModel.createNewUserOwner(body);
  try {
    await EmailService.sendUserMobileCredentialEmail({ to: result.email, username: result.username, role: result.role });
  } catch (emailError) {
    console.error("Gagal mengirim email create owner:", emailError.message);
  }
  return res.status(201).json({ message: "CREATE new User Owner success", data: result });
};

const getAllUserOwner = async (req, res) => {
  const data = await UserOwnerModel.getAllUserOwner(req.query.idMitra, req.query.status);
  return res.status(200).json({ message: "Get All User Owner success", data });
};

const getUserOwnerById = async (req, res) => {
  const data = await UserOwnerModel.getUserOwnerById(req.params.id);
  return res.status(200).json({ message: "Get User Owner by Id success", data });
};

const updateUserOwner = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");
  const missingFields = getMissingRequiredFields(body, ["namaLengkap", "noTelp", "email", "updatedBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const data = await UserOwnerModel.updateUserOwner(req.params.id, body);
  return res.status(200).json({ message: "UPDATE User Owner success", data });
};

const deleteUserOwner = async (req, res) => {
  await UserOwnerModel.deleteUserOwner(req.params.id, req.user.username);
  return res.status(200).json({ message: "Delete User Owner success", data: null });
};

const restoreUserOwner = async (req, res) => {
  await UserOwnerModel.restoreUserOwner(req.params.id, req.user.username);
  return res.status(200).json({ message: "Restore User Owner success", data: null });
};

const resetDeviceId = async (req, res) => {
  const username = await UserOwnerModel.resetDeviceId(req.params.id, req.body, req.user.username);
  return res.status(200).json({ message: "Reset Device ID success", data: { username } });
};

const changePassword = async (req, res) => {
  const requiredFields = ["oldPassword", "newPassword", "ConfirmNewPassword"];
  const missingFields = requiredFields.filter((field) => !req.body[field]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  if (req.body.newPassword !== req.body.ConfirmNewPassword) return res.status(400).json({ error: "Password baru dan konfirmasi tidak cocok" });
  if (req.body.oldPassword === req.body.newPassword) return res.status(400).json({ error: "Password baru tidak boleh sama dengan password lama" });
  const username = await UserOwnerModel.changePassword(req.params.id, req.body, req.user.username);
  return res.status(200).json({ message: "Password changed successfully", data: { username } });
};

const resetPassword = async (req, res) => {
  try {
    const result = await UserOwnerModel.resetPassword(req.params.email);
    try {
      await EmailService.sendResetPasswordEmail({ to: result.email, username: result.username, role: result.role });
    } catch (emailError) {
      console.error("Gagal mengirim email reset password:", emailError.message);
    }
  } catch (error) {
    console.error("Gagal memproses permintaan reset password owner:", error.message);
  }
  return sendResetPasswordAccepted(res);
};

module.exports = { createNewUserOwner, getAllUserOwner, getUserOwnerById, updateUserOwner, deleteUserOwner, restoreUserOwner, resetDeviceId, changePassword, resetPassword };
