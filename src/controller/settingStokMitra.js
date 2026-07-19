const SettingStokModel = require("../models/settingStokMitra");
const { MOBILE_ROLES, normalizeMobileRole } = require("../domain/auth");

const isOwner = (user) => normalizeMobileRole(user?.role) === MOBILE_ROLES.OWNER;
const ownerOnly = (req, res, message) => {
  if (!isOwner(req.user)) { res.status(403).json({ message }); return false; }
  return true;
};

const createNewSetting = async (req, res) => {
  if (!ownerOnly(req, res, "Akses ditolak: Hanya akun Owner yang diizinkan untuk mengatur stok minimum")) return;
  const items = req.body.item;
  if (!Array.isArray(items)) return res.status(400).json({ message: "Bad request, item must be an array" });
  for (const [index, itemDetail] of items.entries()) {
    if (itemDetail.itemId === undefined || itemDetail.batasMinimum === undefined) return res.status(400).json({ message: `Bad request, missing itemId or batasMinimum at index ${index}` });
  }
  const result = await SettingStokModel.createBulkSettings(req.user.idMitra, items, req.user.username);
  return res.status(201).json({ message: "CREATE setting stok success", data: result });
};

const updateSetting = async (req, res) => {
  if (!ownerOnly(req, res, "Akses ditolak: Hanya akun Owner yang diizinkan")) return;
  if (req.body.batasMinimum === undefined || req.body.batasMinimum === null) return res.status(400).json({ message: "Bad request, missing batasMinimum" });
  const existingSetting = await SettingStokModel.getSettingById(req.params.id);
  if (!existingSetting) return res.status(404).json({ error: "data not found" });
  if (Number(existingSetting.idMitra) !== Number(req.user.idMitra)) return res.status(403).json({ message: "Akses ditolak: Anda tidak memiliki izin untuk mengubah data mitra lain" });
  const data = await SettingStokModel.updateSetting(req.params.id, { ...req.body, updatedBy: req.user.username });
  return res.status(200).json({ message: "UPDATE setting stok success", data });
};

const getAllSettings = async (req, res) => {
  if (!ownerOnly(req, res, "Akses ditolak: Hanya akun Owner yang diizinkan")) return;
  return res.status(200).json({ message: "Get All success", data: await SettingStokModel.getAllSettings(req.user.idMitra) });
};

const getSettingByIdMitra = async (req, res) => {
  if (!ownerOnly(req, res, "Akses ditolak: Hanya akun Owner yang diizinkan")) return;
  if (Number(req.params.idMitra) !== Number(req.user.idMitra)) return res.status(403).json({ message: "Akses ditolak: Anda tidak memiliki izin untuk melihat data mitra lain" });
  return res.status(200).json({ message: "Get success", data: await SettingStokModel.getSettingByIdMitra(req.params.idMitra) });
};

module.exports = { createNewSetting, updateSetting, getAllSettings, getSettingByIdMitra };
