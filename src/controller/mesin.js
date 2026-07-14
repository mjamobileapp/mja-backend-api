const MesinModel = require("../models/mesin");
const { getMissingRequiredFields } = require("../utils/validation");

const createNewMesin = async (req, res) => {
  const { body } = req;

  const missingFields = getMissingRequiredFields(body, ["idMitra", "cabangId", "espId"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

    // Validasi washer dan dryer sebagai angka 0 atau 1
  const washer = body.washer;
  const dryer = body.dryer;

  if ((washer === undefined || washer === null) && (dryer === undefined || dryer === null)) {
    return res.status(400).json({
      error: "Field washer atau dryer harus diisi",
    });
  }

  if (washer !== undefined && washer !== null && washer !== 0 && washer !== 1) {
    return res.status(400).json({
      error: "Field washer harus bernilai 0 atau 1",
    });
  }

  if (dryer !== undefined && dryer !== null && dryer !== 0 && dryer !== 1) {
    return res.status(400).json({
      error: "Field dryer harus bernilai 0 atau 1",
    });
  }

  if (washer !== 1 && dryer !== 1) {
    return res.status(400).json({
      error: "Minimal salah satu washer atau dryer harus bernilai 1",
    });
  }

  try {
    const createdBy = req.user ? req.user.username || req.user.id : null;
    const result = await MesinModel.createNewMesin(body, createdBy);
    res.status(201).json({
      message: "CREATE new Mesin success",
      data: result,
    });
  } catch (error) {
    if (
      error.message === "Mitra tidak ditemukan atau tidak aktif" || 
      error.message === "Cabang tidak ditemukan / tidak aktif / tidak sesuai dengan Mitra" || 
      error.message === "Minimal harus mengisi satu data mesin (Washer atau Dryer)" ||
      error.message === "Minimal salah satu washer atau dryer harus bernilai 1" ||
      error.message === "Modul ESP ini sudah terdaftar di cabang yang sama" ||
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
  const { id: idMesinMaster } = req.params;
  const { body } = req;
  const updatedBy = req.user ? req.user.username || req.user.id : null;

  const missingFields = getMissingRequiredFields(body, ["idMitra", "cabangId", "espId"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  // Validasi washer dan dryer sebagai angka 0 atau 1
  const washer = body.washer;
  const dryer = body.dryer;

  if (washer === undefined || washer === null) {
    return res.status(400).json({
      error: "Field washer harus diisi",
    });
  }

  if (dryer === undefined || dryer === null) {
    return res.status(400).json({
      error: "Field dryer harus diisi",
    });
  }

  if (washer !== 0 && washer !== 1) {
    return res.status(400).json({
      error: "Field washer harus bernilai 0 atau 1",
    });
  }

  if (dryer !== 0 && dryer !== 1) {
    return res.status(400).json({
      error: "Field dryer harus bernilai 0 atau 1",
    });
  }

  try {
    const data = await MesinModel.updateMesin(idMesinMaster, body, updatedBy);
    res.status(200).json({
      message: "UPDATE Mesin success",
      data: data,
    });
  } catch (error) {
    if (error.message === "Modul mesin tidak ditemukan di sistem.") {
      return res.status(404).json({
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
  // Mengambil username dari middleware authenticate (req.user)
  const username = req.user.username;

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

  try {
    const data = await MesinModel.getMesinById(id);
    res.status(200).json({
      message: "get Data Mesin success",
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
      success: "Get Mesin by Id Mitra success",
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
      success: "Get Mesin by Id Cabang success",
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

const getMesinByEspId = async (req, res) => {
  const { espId } = req.params;

  try {
    const data = await MesinModel.getMesinByEspId(espId);
    res.status(200).json({
      message: "get Data Mesin success",
      data: data,
    });
  } catch (error) {
    if (error.message === "Data not found") {
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

const getListMesinMobile = async (req, res) => {
  const { cabangId } = req.params;
  const filter = req.query.filter ? String(req.query.filter).toLowerCase() : null;

  if (filter && filter !== "washer" && filter !== "dryer") {
    return res.status(400).json({
      error: "Filter harus berisi washer atau dryer",
    });
  }

  try {
    // User mobile membawa idMitra pada profilnya. Backoffice tidak membawa tenant
    // di token, sehingga tenant diturunkan dari cabang yang diminta.
    const idMitra = req.user?.idMitra || await MesinModel.getMitraIdByCabangId(cabangId);
    const data = await MesinModel.getListMesinMobile(cabangId, idMitra, filter);
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    if (error.message === "Data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAllMasterMesin = async (req, res) => {
  try {
    const data = await MesinModel.getAllMasterMesin();
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    if (error.message === "Data not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const setMaintenance = async (req, res) => {
  const { idMesinDetail } = req.params;
  const updatedBy = req.user ? req.user.username || req.user.id : null;

  try {
    const data = await MesinModel.setMaintenance(idMesinDetail, updatedBy);
    res.status(200).json({
      success: "Set Mesin to Maintenance Success",
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

const setReady = async (req, res) => {
  const { idMesinDetail } = req.params;
  const updatedBy = req.user ? req.user.username || req.user.id : null;

  try {
    const data = await MesinModel.setReady(idMesinDetail, updatedBy);
    res.status(200).json({
      success: "Set Mesin to Ready Success",
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

module.exports = {
  createNewMesin,
  updateMesin,
  deleteMesin,
  restoreMesin,
  getMesinById,
  getAllMesin,
  getAllMasterMesin,
  getMesinByIdMitra,
  getMesinByIdCabang,
  getMesinByEspId,
  getListMesinMobile,
  setMaintenance,
  setReady,
};

