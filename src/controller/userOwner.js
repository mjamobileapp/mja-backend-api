const UserOwnerModel = require("../models/userOwner");
const EmailService = require("../utils/email");
const { sendResetPasswordAccepted } = require("../utils/publicAuth");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");
const { audit, getAuditSnapshot, A, E } = require("../utils/auditBackoffice");

const createNewUserOwner = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");
  const missingFields = getMissingRequiredFields(body, ["username", "idMitra", "namaLengkap", "noTelp", "email", "createdBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const result = await UserOwnerModel.createNewUserOwner(body);
  await audit(req, A.CREATE, E.USER_OWNER, result?.id, null, result);
  try {
    await EmailService.sendUserMobileCredentialEmail({ to: result.email, username: result.username, role: result.role });
  } catch (emailError) {
    req.log.error({ err: emailError, event: "create_owner_email_failed" }, "Gagal mengirim email create owner");
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
  const oldValues = await getAuditSnapshot(UserOwnerModel, "getUserOwnerById", req.params.id);
  const body = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");
  const missingFields = getMissingRequiredFields(body, ["namaLengkap", "noTelp", "email", "updatedBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const data = await UserOwnerModel.updateUserOwner(req.params.id, body);
  await audit(req, A.UPDATE, E.USER_OWNER, req.params.id, oldValues, data);
  return res.status(200).json({ message: "UPDATE User Owner success", data });
};

const deleteUserOwner = async (req, res) => {
  const oldValues = await getAuditSnapshot(UserOwnerModel, "getUserOwnerById", req.params.id);
  await UserOwnerModel.deleteUserOwner(req.params.id, req.user.username);
  await audit(req, A.DELETE, E.USER_OWNER, req.params.id, oldValues, { statusAktif: false });
  return res.status(200).json({ message: "Delete User Owner success", data: null });
};

const restoreUserOwner = async (req, res) => {
  await UserOwnerModel.restoreUserOwner(req.params.id, req.user.username);
  await audit(req, A.RESTORE, E.USER_OWNER, req.params.id, { statusAktif: false }, { statusAktif: true });
  return res.status(200).json({ message: "Restore User Owner success", data: null });
};

const resetDeviceId = async (req, res) => {
  const username = await UserOwnerModel.resetDeviceId(req.params.id, req.body, req.user.username);
  await audit(req, A.RESET_DEVICE, E.USER_OWNER, req.params.id, null, { username, deviceId: null });
  return res.status(200).json({ message: "Reset Device ID success", data: { username } });
};

const changePassword = async (req, res) => {
  const requiredFields = ["oldPassword", "newPassword", "ConfirmNewPassword"];
  const missingFields = requiredFields.filter((field) => !req.body[field]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  if (req.body.newPassword !== req.body.ConfirmNewPassword) return res.status(400).json({ error: "Password baru dan konfirmasi tidak cocok" });
  if (req.body.oldPassword === req.body.newPassword) return res.status(400).json({ error: "Password baru tidak boleh sama dengan password lama" });
  const username = await UserOwnerModel.changePassword(req.params.id, req.body, req.user.username);
  await audit(req, A.CHANGE_PASSWORD, E.USER_OWNER, req.params.id, null, { username });
  return res.status(200).json({ message: "Password changed successfully", data: { username } });
};

const resetPassword = async (req, res) => {
  try {
    const result = await UserOwnerModel.resetPassword(req.params.email);
    try {
      await EmailService.sendResetPasswordEmail({ to: result.email, username: result.username, role: result.role });
    } catch (emailError) {
      req.log.error({ err: emailError, event: "owner_password_reset_email_failed" }, "Gagal mengirim email reset password");
    }
  } catch (error) {
    req.log.error({ err: error, event: "owner_password_reset_failed" }, "Gagal memproses permintaan reset password owner");
  }
  return sendResetPasswordAccepted(res);
};

module.exports = { createNewUserOwner, getAllUserOwner, getUserOwnerById, updateUserOwner, deleteUserOwner, restoreUserOwner, resetDeviceId, changePassword, resetPassword };
