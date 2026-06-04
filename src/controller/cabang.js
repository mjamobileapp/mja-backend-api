const CabangModel = require("../models/cabang");

const createNewCabang = async (req, res) => {
  const { body } = req;
  console.log("BODY REQUEST:", body);

  if (!body.idMitra || !body.namaCabang || !body.alamatCabang || !body.createdBy) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
    });
  }

  try {
    const result = await CabangModel.createNewCabang(body);
    res.status(201).json({
      message: "CREATE new Cabang success",
      data: result,
    });
  } catch (error) {
    if (error.message === "Cabang sudah terdaftar" || error.message === "Mitra tidak ditemukan") {
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
  if (!body.namaCabang || !body.alamatCabang || !body.updatedBy) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
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

  console.log("DELETE REQUEST:", { id });

  try {
    await CabangModel.deleteCabang(id);
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
  console.log("GET ALL REQUEST");

  try {
    const data = await CabangModel.getAllCabang();
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

module.exports = {
  createNewCabang,
  updateCabang,
  deleteCabang,
  getCabangById,
  getAllCabang,
};
