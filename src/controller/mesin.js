const MesinModel = require("../models/mesin");

const createNewMesin = async (req, res) => {
  const { body } = req;
  console.log("BODY REQUEST:", body);

  const requiredFields = ['idMitra', 'cabangId', 'espId'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  if (!body.washer && !body.dryer) {
    return res.status(400).json({
      message: "Bad request, at least one of washer or dryer must be provided",
    });
  }

  if (body.washer && !body.washer.namaMesin) {
    return res.status(400).json({
      error: "Field namaMesin pada washer diperlukan",
    });
  }

  if (body.dryer && !body.dryer.namaMesin) {
    return res.status(400).json({
      error: "Field namaMesin pada dryer diperlukan",
    });
  }

  try {
    const result = await MesinModel.createNewMesin(body);
    res.status(201).json({
      message: "CREATE new Mesin success",
      data: result,
    });
  } catch (error) {
    if (
      error.message === "Mitra tidak ditemukan atau tidak aktif" || 
      error.message === "Cabang tidak ditemukan / tidak aktif / tidak sesuai dengan Mitra" || 
      error.message === "Minimal harus mengisi satu data mesin (Washer atau Dryer)" ||
      error.message === "Mesin dengan espId dan tipe WASHER yang sama sudah terdaftar" ||
      error.message === "Mesin dengan espId dan tipe DRYER yang sama sudah terdaftar"
    ) {
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

const updateMesin = async (req, res) => {
  const { id } = req.params;
  const { body } = req;

  console.log("UPDATE REQUEST:", { id, body });

    // Validate required fields
  const requiredFields = ['namaMesin', 'tipeMesin', 'kapasitas', 'ipAddressEsp', 'macAddress', 'updatedBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    const data = await MesinModel.updateMesin(id, body);
    res.status(200).json({
      message: "UPDATE Mesin success",
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

const deleteMesin = async (req, res) => {
  const { id } = req.params;
  // Mengambil username dari middleware authenticate (req.user)
  const username = req.user.username;

  console.log("DELETE REQUEST:", { id, deletedBy: username });

  try {
    await MesinModel.deleteMesin(id, username);
    res.status(200).json({
      message: "Delete Mesin success",
      data: null,
    });
  } catch (error) {
    if (error.message === "Mesin sedang menyala") {
      return res.status(400).json({
        error: error.message,
      });
    }
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

const getMesinById = async (req, res) => {
  const { id } = req.params;

  console.log("GET BY ID REQUEST:", { id });

  try {
    const data = await MesinModel.getMesinById(id);
    res.status(200).json({
      message: "Get by Id Mesin success",
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

const getAllMesin = async (req, res) => {
  const { status } = req.query;
  console.log("GET ALL REQUEST - Status Filter:", status || "active (default)");

  try {
    const data = await MesinModel.getAllMesin(status);
    res.status(200).json({
      message: "Get All Mesin success",
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getMesinByIdMitra = async (req, res) => {
  const { idMitra } = req.params;
  try {
    const data = await MesinModel.getMesinByIdMitra(idMitra);
    res.status(200).json({
      message: "Get Mesin by Id Mitra success",
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getMesinByIdCabang = async (req, res) => {
  const { cabangId } = req.params;
  try {
    const data = await MesinModel.getMesinByIdCabang(cabangId);
    res.status(200).json({
      message: "Get Mesin by Id Cabang success",
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const restoreMesin = async (req, res) => {
  const { id } = req.params;
  // Mengambil username dari middleware authenticate (req.user)
  const username = req.user.username;

  console.log("RESTORE MESIN REQUEST:", { id, updatedBy: username });

  try {
    await MesinModel.restoreMesin(id, username);
    res.status(200).json({
      message: "Restore Mesin success",
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
  createNewMesin,
  updateMesin,
  deleteMesin,
  restoreMesin,
  getMesinById,
  getAllMesin,
  getMesinByIdMitra,
  getMesinByIdCabang,
};
