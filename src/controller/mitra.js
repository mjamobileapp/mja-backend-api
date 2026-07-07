const MitraModel = require("../models/mitra");

const createNewMitra = async (req, res) => {
  const { body } = req;
  console.log("BODY REQUEST:", body);

    const requiredFields = ['namaMitra', 'alamatMitra', 'createdBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
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
  const requiredFields = ['namaMitra', 'alamatMitra', 'updatedBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
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
  // Mengambil username dari middleware authenticate (req.user)
  const username = req.user.username;

  console.log("DELETE REQUEST:", { id, updatedBy: username });

  try {
    await MitraModel.deleteMitra(id, username);
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
  const { status } = req.query;
  console.log("GET ALL REQUEST - Status Filter:", status || "active (default)");

  try {
    const data = await MitraModel.getAllMitra(status);
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

const restoreMitra = async (req, res) => {
  const { id } = req.params;
  // Mengambil username dari middleware authenticate (req.user)
  const username = req.user.username;

  console.log("RESTORE REQUEST:", { id, updatedBy: username });

  try {
    await MitraModel.restoreMitra(id, username);
    res.status(200).json({
      message: "Restore Mitra success",
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
  createNewMitra,
  updateMitra,
  deleteMitra,
  restoreMitra,
  getMitraById,
  getAllMitra,
};
