const MitraModel = require("../models/mitra");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");

const createNewMitra = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");

  const missingFields = getMissingRequiredFields(body, ["namaMitra", "alamatMitra", "createdBy"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  const result = await MitraModel.createNewMitra(body);
  return res.status(201).json({ message: "CREATE new Mitra success", data: result });
};

const updateMitra = async (req, res) => {
  const { id } = req.params;
  const body = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");

  const missingFields = getMissingRequiredFields(body, ["namaMitra", "alamatMitra", "updatedBy"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  const data = await MitraModel.updateMitra(id, body);
  return res.status(200).json({ message: "UPDATE Mitra success", data });
};

const deleteMitra = async (req, res) => {
  const { id } = req.params;
  // Mengambil username dari middleware authenticate (req.user)
  const username = req.user.username;

  await MitraModel.deleteMitra(id, username);
  return res.status(200).json({ message: "Delete Mitra success", data: null });
};

const getMitraById = async (req, res) => {
  const { id } = req.params;

  const data = await MitraModel.getMitraById(id);
  return res.status(200).json({ message: "Get by Id Mitra success", data });
};

const getAllMitra = async (req, res) => {
  const { status } = req.query;
  const data = await MitraModel.getAllMitra(status);
  return res.status(200).json({ message: "Get All Mitra success", data });
};

const restoreMitra = async (req, res) => {
  const { id } = req.params;
  // Mengambil username dari middleware authenticate (req.user)
  const username = req.user.username;

  await MitraModel.restoreMitra(id, username);
  return res.status(200).json({ message: "Restore Mitra success", data: null });
};

module.exports = {
  createNewMitra,
  updateMitra,
  deleteMitra,
  restoreMitra,
  getMitraById,
  getAllMitra,
};
