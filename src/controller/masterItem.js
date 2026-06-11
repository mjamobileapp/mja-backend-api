const MasterItemModel = require("../models/masterItem");

const createNewMasterItem = async (req, res) => {
  const { body } = req;

    // 1. Validasi Request Body
  const requiredFields = ['namaItem', 'tipeItem', 'createdBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    // 2. Panggil Model untuk simpan data
    const result = await MasterItemModel.createNewMasterItem(body);

    res.status(201).json({
      message: "CREATE new Master Item success",
      data: result,
    });
  } catch (error) {
    // 3. Handle error spesifik (Duplikasi)
    if (error.message === "Master Item sudah terdaftar") {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getAllMasterItem = async (req, res) => {
  const { status } = req.query;
  try {
    const data = await MasterItemModel.getAllMasterItem(status);
    res.status(200).json({
      message: "Get All Master Item success",
      data: data,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const getMasterItemById = async (req, res) => {
  const { id } = req.params;
  try {
    const data = await MasterItemModel.getMasterItemById(id);
    res.status(200).json({
      message: "Get Master Item by Id success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const getMasterItemByTipe = async (req, res) => {
  const { tipeItem } = req.params;

  // Validasi sederhana tipeItem
  const validTypes = ["stok", "non_stok"];
  if (!validTypes.includes(tipeItem)) {
    return res.status(400).json({
      error: "Tipe item tidak valid. Gunakan 'stok' atau 'non_stok'.",
    });
  }

  try {
    const data = await MasterItemModel.getMasterItemByTipe(tipeItem);
    res.status(200).json({
      message: "Get by Tipe Item Success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const updateMasterItem = async (req, res) => {
  const { id } = req.params;
  const { body } = req;

    const requiredFields = ['namaItem', 'tipeItem', 'updatedBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    const data = await MasterItemModel.updateMasterItem(id, body);
    res.status(200).json({
      message: "UPDATE Master Item success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    if (error.message === "Master Item sudah terdaftar") return res.status(400).json({ error: error.message });
    
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const deleteMasterItem = async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;

  try {
    await MasterItemModel.deleteMasterItem(id, username);
    res.status(200).json({
      message: "Delete Master Item success",
      data: null,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const restoreMasterItem = async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;

  try {
    await MasterItemModel.restoreMasterItem(id, username);
    res.status(200).json({
      message: "Restore Master Item success",
      data: null,
    });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

module.exports = {
  createNewMasterItem,
  getAllMasterItem,
  getMasterItemById,
  getMasterItemByTipe,
  updateMasterItem,
  deleteMasterItem,
  restoreMasterItem,
};