const CabangModel = require("../models/cabang");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");

const createNewCabang = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");

  const missingFields = getMissingRequiredFields(body, ["idMitra", "namaCabang", "alamatCabang", "createdBy"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    const result = await CabangModel.createNewCabang(body);

    res.status(201).json({
      message: "CREATE new Cabang success",
      data: result,
    });
  } catch (error) {
    if (error.message === "Mitra tidak ditemukan atau tidak aktif" || error.message === "Cabang sudah terdaftar") {
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

const updateCabang = async (req, res) => {
  const { id } = req.params;
  const body = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");

  const missingFields = getMissingRequiredFields(body, ["namaCabang", "alamatCabang", "updatedBy"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    const data = await CabangModel.updateCabang(id, body);
    res.status(200).json({
      message: "UPDATE Cabang success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const deleteCabang = async (req, res) => {
  const { id } = req.params;
  // Mengambil username dari middleware authenticate (req.user)
  const username = req.user.username;

  try {
    await CabangModel.deleteCabang(id, username);
    res.status(200).json({
      message: "Delete Cabang success",
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
      serverMessage: error.message,
    });
  }
};

const getCabangById = async (req, res) => {
  const { id } = req.params;

  try {
    const data = await CabangModel.getCabangById(id);
    res.status(200).json({
      message: "Get by Id Cabang success",
      data: data,
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getAllCabang = async (req, res) => {
  const { status } = req.query;
  try {
    const data = await CabangModel.getAllCabang(status);
    res.status(200).json({
      message: "Get All Cabang success",
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getCabangByIdMitra = async (req, res) => {
  const { idMitra } = req.params;
  try {
    const data = await CabangModel.getCabangByIdMitra(idMitra);
    res.status(200).json({
      message: "Get Cabang by Id Mitra success",
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const restoreCabang = async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;

  try {
    await CabangModel.restoreCabang(id, username);
    res.status(200).json({
      message: "Restore Cabang success",
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
      serverMessage: error.message,
    });
  }
};

const resetCabang = async (req, res) => {
  const { id } = req.params;
  const { konfirmasi } = req.body;

  if (konfirmasi !== "RESET") {
    return res.status(400).json({
      error: "konfirmasi tidak sesuai",
    });
  }

  try {
    await CabangModel.resetCabang(id);
    res.status(200).json({
      success: "Reset Data Cabang Success",
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  createNewCabang,
  updateCabang,
  deleteCabang,
  restoreCabang,
  resetCabang,
  getCabangById,
  getAllCabang,
  getCabangByIdMitra,
};
