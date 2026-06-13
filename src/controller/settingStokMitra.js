const SettingStokModel = require("../models/settingStokMitra");

const createNewSetting = async (req, res) => {
  const { body } = req;
  const requiredFields = ['idMitra', 'idItem', 'stokMinimum', 'createdBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  }

  try {
    const result = await SettingStokModel.createNewSetting(body);
    res.status(201).json({ message: "CREATE setting stok success", data: result });
  } catch (error) {
    if (["Mitra tidak ditemukan atau tidak aktif", "Item tidak ditemukan atau tidak aktif"].includes(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const updateSetting = async (req, res) => {
  const { id } = req.params;
  const { body } = req;

  // Perbaikan PR #70: Pastikan stokMinimum: 0 tidak dianggap missing
  if (body.stokMinimum === undefined || body.stokMinimum === null || !body.updatedBy) {
    return res.status(400).json({ message: "Bad request, missing stokMinimum or updatedBy" });
  }

  try {
    const data = await SettingStokModel.updateSetting(id, body);
    res.status(200).json({ message: "UPDATE setting stok success", data });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const getAllSettings = async (req, res) => {
  try {
    const data = await SettingStokModel.getAllSettings();
    res.status(200).json({ message: "Get All success", data });
  } catch (error) {
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const getSettingByIdMitra = async (req, res) => {
  const { idMitra } = req.params;
  try {
    const data = await SettingStokModel.getSettingByIdMitra(idMitra);
    res.status(200).json({ message: "Get success", data });
  } catch (error) {
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

module.exports = {
  createNewSetting,
  updateSetting,
  getAllSettings,
  getSettingByIdMitra
};