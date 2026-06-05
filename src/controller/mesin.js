const MesinModel = require("../models/mesin");

const createNewMesin = async (req, res) => {
  const { body } = req;
  console.log("BODY REQUEST:", body);

  if (!body.idMitra || !body.cabangId || !body.namaMesin || !body.tipeMesin || !body.kapasitas || !body.ipAddressEsp || !body.macAddress || !body.status || !body.createdBy) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
    });
  }

  try {
    const result = await MesinModel.createNewMesin(body);
    res.status(201).json({
      message: "CREATE new Mesin success",
      data: result,
    });
  } catch (error) {
    if (error.message === "Mitra tidak ditemukan" || error.message === "Cabang tidak ditemukan" || error.message === "Cabang tidak ditemukan atau tidak sesuai dengan Mitra" || error.message === "Mesin dengan IP Address yang sama sudah terdaftar") {
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
  if (!body.namaMesin || !body.tipeMesin || !body.kapasitas || !body.ipAddressEsp || !body.macAddress || !body.updatedBy) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
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
