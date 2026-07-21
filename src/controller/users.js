const UsersModel = require("../models/users");
const bcrypt = require("bcrypt");
const { generateToken, TOKEN_TYPES } = require("../utils/jwt");
const EmailService = require("../utils/email");
const { sendResetPasswordAccepted } = require("../utils/publicAuth");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");
const { ACCOUNT_TYPES } = require("../domain/auth");
const { recordBackofficeAudit } = require("../services/auditBackoffice");
const { BACKOFFICE_AUDIT_ACTIONS, BACKOFFICE_AUDIT_ENTITIES } = require("../domain/auditBackoffice");
const { audit, getAuditSnapshot, A, E } = require("../utils/auditBackoffice");

const getAllUsers = async (req, res) => {
  const [data] = await UsersModel.getAllUser(req.query.status);
  const mappedData = data.map((item) => ({ id: item.id, nama: item.nama, idRole: item.roleId, namaRole: item.namaRole, username: item.username, statusAktif: item.statusAktif }));
  await audit(req, A.READ, E.USER, null, null, { count: mappedData.length, status: req.query.status || "active" });
  return res.json({ message: "GET all Master User success", data: mappedData });
};

const getUserById = async (req, res) => {
  const [data] = await UsersModel.getUserById(req.params.id);
  if (!data[0]) return res.status(404).json({ message: "User not found" });
  const item = data[0];
  const mappedData = { id: item.id, nama: item.nama, idRole: item.roleId, namaRole: item.namaRole, username: item.username, statusAktif: item.statusAktif };
  await audit(req, A.READ, E.USER, req.params.id, null, mappedData);
  return res.json({ message: "Get by Id User success", data: mappedData });
};

const createNewUser = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");
  const missingFields = getMissingRequiredFields(body, ["nama", "username", "password", "roleId", "createdBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const data = await UsersModel.createNewUser(body);
  await audit(req, A.CREATE, E.USER, data.id, null, { ...data, password: undefined });
  return res.status(201).json({ message: "CREATE new User success", data });
};

const loginUser = async (req, res) => {
  const { username, password } = req.body;
  const [activeUsers] = await UsersModel.validateUser(username);
  const [allUsers] = activeUsers.length ? [activeUsers] : await UsersModel.getUserByUsername(username);
  const candidate = allUsers[0];
  const failed = async (reason, actor = {}) => { await recordBackofficeAudit({ req, actor: { ...actor, username: actor.username || username || "unknown", accountType: "backoffice" }, actionType: BACKOFFICE_AUDIT_ACTIONS.LOGIN_FAILED, entityName: BACKOFFICE_AUDIT_ENTITIES.AUTHENTICATION, entityId: actor.userId || actor.id, newValues: { reason } }); };
  if (!candidate) { await failed("INVALID_CREDENTIALS"); return res.status(401).json({ message: "Invalid username or password" }); }
  if (!candidate.statusAktif) { await failed("USER_INACTIVE", { userId: candidate.id, username: candidate.username }); return res.status(401).json({ message: "Invalid username or password" }); }
  const user = [candidate];
  if (!await bcrypt.compare(password, user[0].password)) { await failed("INVALID_CREDENTIALS", { userId: user[0].id, username: user[0].username }); return res.status(401).json({ message: "Invalid username or password" }); }
  const [dataUser_] = await UsersModel.identitiyUser(username);
  if (dataUser_.length === 0) { await failed("ROLE_NOT_ASSIGNED", { userId: user[0].id, username: user[0].username }); return res.status(401).json({ message: "user belum mempunyai role" }); }
  const dataUser = dataUser_[0];
  const token = generateToken(dataUser, TOKEN_TYPES.BACKOFFICE);
  await recordBackofficeAudit({ req, actor: { userId: dataUser.id_user, username: dataUser.username, role: dataUser.namaRole, accountType: "backoffice" }, actionType: BACKOFFICE_AUDIT_ACTIONS.LOGIN_SUCCESS, entityName: BACKOFFICE_AUDIT_ENTITIES.AUTHENTICATION, entityId: dataUser.id_user });
  return res.json({ message: "Login successful", data: { id: dataUser.id_user, username: dataUser.username, nama: dataUser.nama, role: dataUser.namaRole, statusAktif: dataUser.statusAktif, token } });
};

const updateUser = async (req, res) => {
  const oldValues = await getAuditSnapshot(UsersModel, "getUserById", req.params.id);
  const body = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");
  const missingFields = getMissingRequiredFields(body, ["nama", "username", "roleId", "updatedBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  await UsersModel.updateUser(body, req.params.id);
  await audit(req, A.UPDATE, E.USER, req.params.id, oldValues, { ...body, password: undefined });
  return res.json({ message: "UPDATE Users success", data: { id: req.params.id, ...body, statusAktif: true } });
};

const deleteUser = async (req, res) => {
  const oldValues = await getAuditSnapshot(UsersModel, "getUserById", req.params.id);
  await UsersModel.deleteUser(req.params.id, req.user.username);
  await audit(req, A.DELETE, E.USER, req.params.id, oldValues, { statusAktif: false });
  return res.json({ message: "DELETE Users success", data: null });
};

const restoreUser = async (req, res) => {
  await UsersModel.restoreUser(req.params.id, req.user.username);
  await audit(req, A.RESTORE, E.USER, req.params.id, { statusAktif: false }, { statusAktif: true });
  return res.json({ message: "RESTORE Users success", data: null });
};

const changePassword = async (req, res) => {
  const requiredFields = ["oldPassword", "newPassword", "ConfirmNewPassword"];
  const missingFields = requiredFields.filter((field) => !req.body[field]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  if (req.body.newPassword !== req.body.ConfirmNewPassword) return res.status(400).json({ error: "Konfirmasi password baru tidak cocok" });
  const resultUsername = await UsersModel.changePassword(req.params.id, req.body, req.user.username);
  await audit(req, A.CHANGE_PASSWORD, E.USER, req.params.id, null, { username: resultUsername });
  return res.json({ message: "Password changed successfully", data: { username: resultUsername } });
};

const resetPassword = async (req, res) => {
  try {
    const result = await UsersModel.resetPassword(req.params.email);
    await recordBackofficeAudit({ req, actor: { username: result.username, role: "unknown", accountType: "backoffice" }, actionType: BACKOFFICE_AUDIT_ACTIONS.RESET_PASSWORD, entityName: BACKOFFICE_AUDIT_ENTITIES.AUTHENTICATION, newValues: { reason: "REQUESTED" } });
    try {
      await EmailService.sendResetPasswordEmail({ to: result.email, username: result.username, role: ACCOUNT_TYPES.BACKOFFICE });
    } catch (emailError) {
      req.log.error({ err: emailError, event: "backoffice_password_reset_email_failed" }, "Gagal mengirim email reset password backoffice");
    }
  } catch (error) {
    await recordBackofficeAudit({ req, actor: { username: req.params.email || "unknown", role: "unknown", accountType: "backoffice" }, actionType: BACKOFFICE_AUDIT_ACTIONS.RESET_PASSWORD, entityName: BACKOFFICE_AUDIT_ENTITIES.AUTHENTICATION, newValues: { reason: "ACCOUNT_NOT_FOUND" } });
    req.log.error({ err: error, event: "backoffice_password_reset_failed" }, "Gagal memproses permintaan reset password backoffice");
  }
  return sendResetPasswordAccepted(res);
};

const logoutUser = async (req, res) => {
  await recordBackofficeAudit({ req, actionType: BACKOFFICE_AUDIT_ACTIONS.LOGOUT, entityName: BACKOFFICE_AUDIT_ENTITIES.AUTHENTICATION, entityId: req.user?.id });
  return res.json({ message: "Logout successful" });
};

module.exports = { getAllUsers, getUserById, createNewUser, updateUser, deleteUser, restoreUser, loginUser, logoutUser, changePassword, resetPassword };
