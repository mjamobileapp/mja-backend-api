const CabangModel = require("../models/cabang");

const createNewCabang = async (req, res) => {
  const { body } = req;
  console.log("BODY REQUEST:", body);

    const requiredFields = ['idMitra', 'namaCabang', 'alamatCabang', 'createdBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

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
  const { body } = req;

  console.log("UPDATE REQUEST:", { id, body });

    // Validate required fields
  const requiredFields = ['namaCabang', 'alamatCabang', 'updatedBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

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

  console.log("DELETE REQUEST:", { id, updatedBy: username });

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

  console.log("GET BY ID REQUEST:", { id });

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
  console.log("GET ALL REQUEST - Status Filter:", status || "active (default)");

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
  console.log("GET BY ID MITRA REQUEST:", { idMitra });

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

  console.log("RESTORE CABANG REQUEST:", { id, updatedBy: username });

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

module.exports = {
  createNewCabang,
  updateCabang,
  deleteCabang,
  restoreCabang,
  getCabangById,
  getAllCabang,
  getCabangByIdMitra,
};
