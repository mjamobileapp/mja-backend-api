const MitraModel = require("../models/mitra");

const createNewMitra = async (req, res) => {
  const { body } = req;
  console.log("BODY REQUEST:", body);

  if (!body.namaMitra || !body.alamatMitra || !body.createdBy) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
    });
  }

  try {
    const result = await MitraModel.createNewMitra(body);

    res.status(201).json({
      message: "CREATE new Mitra success",
      data: result,
    });
  } catch (error) {
    if (error.message === "Mitra sudah terdaftar") {
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

const updateMitra = async (req, res) => {
  const { id } = req.params;
  const { body } = req;

  console.log("UPDATE REQUEST:", { id, body });

  // Validate required fields
  if (!body.namaMitra || !body.alamatMitra || !body.updatedBy) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
    });
  }

  try {
    const data = await MitraModel.updateMitra(id, body);
    res.status(200).json({
      message: "UPDATE Mitra success",
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

const deleteMitra = async (req, res) => {
  const { id } = req.params;

  console.log("DELETE REQUEST:", { id });

  try {
    await MitraModel.deleteMitra(id);
    res.status(200).json({
      message: "Delete Mitra success",
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

const getMitraById = async (req, res) => {
  const { id } = req.params;

  console.log("GET BY ID REQUEST:", { id });

  try {
    const data = await MitraModel.getMitraById(id);
    res.status(200).json({
      message: "Get by Id Mitra success",
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

const getAllMitra = async (req, res) => {
  console.log("GET ALL REQUEST");

  try {
    const data = await MitraModel.getAllMitra();
    res.status(200).json({
      message: "Get All Mitra success",
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
  createNewMitra,
  updateMitra,
  deleteMitra,
  getMitraById,
  getAllMitra,
};
