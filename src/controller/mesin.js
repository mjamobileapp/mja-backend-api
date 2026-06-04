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
    await MesinModel.createNewMesin(body);
        res.status(201).json({
      message: "CREATE new Mesin success",
      data: {
        idMitra: body.idMitra,
        cabangId: body.cabangId,
        namaMesin: body.namaMesin,
        tipeMesin: body.tipeMesin,
        kapasitas: body.kapasitas,
        ipAddressEsp: body.ipAddressEsp,
        macAddress: body.macAddress,
        status: body.status,
        createdBy: body.createdBy,
      },
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
  if (!body.idMitra || !body.cabangId || !body.namaMesin || !body.tipeMesin || !body.kapasitas || !body.ipAddressEsp || !body.macAddress || !body.status || !body.updatedBy) {
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
    if (error.message === "Mitra tidak ditemukan" || error.message === "Cabang tidak ditemukan" || error.message === "Cabang tidak ditemukan atau tidak sesuai dengan Mitra") {
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

const deleteMesin = async (req, res) => {
  const { id } = req.params;

  console.log("DELETE REQUEST:", { id });

  try {
    await MesinModel.deleteMesin(id);
    res.status(200).json({
      message: "Delete Mesin success",
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
  console.log("GET ALL REQUEST");

  try {
    const data = await MesinModel.getAllMesin();
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

module.exports = {
  createNewMesin,
  updateMesin,
  deleteMesin,
  getMesinById,
  getAllMesin,
};
