const CabangModel = require("../models/cabang");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");

const createNewCabang = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");
  const missingFields = getMissingRequiredFields(body, ["idMitra", "namaCabang", "alamatCabang", "createdBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const result = await CabangModel.createNewCabang(body);
  return res.status(201).json({ message: "CREATE new Cabang success", data: result });
};

const updateCabang = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");
  const missingFields = getMissingRequiredFields(body, ["namaCabang", "alamatCabang", "updatedBy"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const data = await CabangModel.updateCabang(req.params.id, body);
  return res.status(200).json({ message: "UPDATE Cabang success", data });
};

const deleteCabang = async (req, res) => {
  await CabangModel.deleteCabang(req.params.id, req.user.username);
  return res.status(200).json({ message: "Delete Cabang success", data: null });
};

const getCabangById = async (req, res) => {
  const data = await CabangModel.getCabangById(req.params.id);
  return res.status(200).json({ message: "Get by Id Cabang success", data });
};

const getAllCabang = async (req, res) => {
  const data = await CabangModel.getAllCabang(req.query.status);
  return res.status(200).json({ message: "Get All Cabang success", data });
};

const getCabangByIdMitra = async (req, res) => {
  const data = await CabangModel.getCabangByIdMitra(req.params.idMitra);
  return res.status(200).json({ message: "Get Cabang by Id Mitra success", data });
};

const restoreCabang = async (req, res) => {
  await CabangModel.restoreCabang(req.params.id, req.user.username);
  return res.status(200).json({ message: "Restore Cabang success", data: null });
};

const resetCabang = async (req, res) => {
  if (req.body.konfirmasi !== "RESET") return res.status(400).json({ error: "konfirmasi tidak sesuai" });
  await CabangModel.resetCabang(req.params.id);
  return res.status(200).json({ success: "Reset Data Cabang Success" });
};

module.exports = { createNewCabang, updateCabang, deleteCabang, restoreCabang, resetCabang, getCabangById, getAllCabang, getCabangByIdMitra };
