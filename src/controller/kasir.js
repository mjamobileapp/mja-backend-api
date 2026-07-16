const KasirModel = require("../models/kasir");
const EmailService = require("../utils/email");
const { sendResetPasswordAccepted } = require("../utils/publicAuth");
const { formatTanggalWIB } = require("../utils/date");
const { getMissingRequiredFields } = require("../utils/validation");
const { MOBILE_ROLES, normalizeMobileRole } = require("../domain/auth");

const createNewUserKasir = async (req, res) => {
  const { body } = req;
  const { idMitra, username: usernameToken } = req.user;
  const missingFields = getMissingRequiredFields(body, ["username", "cabangId", "namaLengkap", "noTelp", "email"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  if (!idMitra || !usernameToken) return res.status(400).json({ error: "idMitra atau username tidak ditemukan di token" });
  const result = await KasirModel.createNewUserKasir({ ...body, idMitra, createdBy: usernameToken });
  try {
    await EmailService.sendUserMobileCredentialEmail({ to: result.email, username: result.username, role: MOBILE_ROLES.KASIR });
  } catch (emailError) { console.error("Gagal mengirim email create kasir:", emailError.message); }
  return res.status(201).json({ message: "CREATE new Kasir success", data: result });
};

const getAllUserKasir = async (req, res) => res.status(200).json({ message: "Get All Kasir success", data: await KasirModel.getAllUserKasir(req.query.status, req.user.idMitra) });
const getUserKasirById = async (req, res) => res.status(200).json({ message: "Get Kasir by Id success", data: await KasirModel.getUserKasirById(req.params.id, req.user.idMitra) });

const updateUserKasir = async (req, res) => {
  const missingFields = getMissingRequiredFields(req.body, ["namaLengkap", "noTelp", "email"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const data = await KasirModel.updateUserKasir(req.params.id, { ...req.body, updatedBy: req.user.username }, req.user.idMitra);
  return res.status(200).json({ message: "UPDATE Kasir success", data });
};
const deleteUserKasir = async (req, res) => { await KasirModel.deleteUserKasir(req.params.id, req.user.username, req.user.idMitra); return res.status(200).json({ message: "Delete Kasir success", data: null }); };
const restoreUserKasir = async (req, res) => { await KasirModel.restoreUserKasir(req.params.id, req.user.username, req.user.idMitra); return res.status(200).json({ message: "Restore Kasir success", data: null }); };
const resetDeviceId = async (req, res) => { const username = await KasirModel.resetDeviceId(req.params.id, req.body, req.user.username, req.user.idMitra); return res.status(200).json({ message: "Reset Device ID success", data: { username } }); };

const changePassword = async (req, res) => {
  const requiredFields = ["oldPassword", "newPassword", "ConfirmNewPassword"];
  const missingFields = requiredFields.filter((field) => !req.body[field]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  if (req.body.newPassword !== req.body.ConfirmNewPassword) return res.status(400).json({ error: "Password baru dan konfirmasi tidak cocok" });
  const username = await KasirModel.changePassword(req.params.id, req.body, req.user.username, req.user.idMitra);
  return res.status(200).json({ message: "Password changed successfully", data: { username } });
};

const resetPassword = async (req, res) => {
  try {
    const result = await KasirModel.resetPassword(req.params.email);
    try { await EmailService.sendResetPasswordEmail({ to: result.email, username: result.username, role: MOBILE_ROLES.KASIR }); }
    catch (emailError) { console.error("Gagal mengirim email reset password:", emailError.message); }
  } catch (error) { console.error("Gagal memproses permintaan reset password kasir:", error.message); }
  return sendResetPasswordAccepted(res);
};

const getAbsensiKasir = async (req, res) => {
  const { tanggal, namaKasir, cabangId: requestedCabangId } = req.query;
  const idMitra = req.user?.idMitra;
  const role = normalizeMobileRole(req.user?.role);
  const tokenCabangId = req.user?.cabang_id || req.user?.cabangId;
  if (!idMitra) return res.status(403).json({ error: "idMitra tidak ditemukan di token" });
  let cabangId;
  if (role === MOBILE_ROLES.KASIR) {
    if (!tokenCabangId) return res.status(403).json({ error: "Cabang kasir tidak ditemukan di token" });
    if (requestedCabangId && Number(requestedCabangId) !== Number(tokenCabangId)) return res.status(403).json({ error: "Kasir hanya dapat mengakses absensi cabangnya sendiri" });
    cabangId = tokenCabangId;
  } else if (role === MOBILE_ROLES.OWNER) {
    if (!requestedCabangId) return res.status(400).json({ error: "Parameter cabangId diperlukan untuk owner" });
    if (!await KasirModel.isCabangOwnedByMitra(requestedCabangId, idMitra)) return res.status(403).json({ error: "Cabang tidak dapat diakses oleh user owner mitra ini" });
    cabangId = requestedCabangId;
  } else return res.status(403).json({ error: "Role tidak diizinkan mengakses absensi kasir" });
  const [data] = await KasirModel.getAbsensiKasir({ cabangId, idMitra, tanggal, namaKasir });
  const mappedData = data.map((item) => ({ id: item.absensiId, tanggalShift: formatTanggalWIB(item.tanggalShift), namaKasir: item.namaKasir, jamMasuk: item.jamMasuk, jamPulang: item.jamPulang }));
  return res.json({ message: "Get Data Absensi Kasir Success", data: mappedData });
};

module.exports = { createNewUserKasir, getAllUserKasir, getUserKasirById, updateUserKasir, deleteUserKasir, restoreUserKasir, resetDeviceId, changePassword, resetPassword, getAbsensiKasir };
