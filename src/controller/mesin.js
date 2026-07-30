const MesinModel = require("../models/mesin");
const { getMissingRequiredFields } = require("../utils/validation");
const { audit, getAuditSnapshot, A, E } = require("../utils/auditBackoffice");

const createNewMesin = async (req, res) => {
  const { body } = req;
  const missingFields = getMissingRequiredFields(body, ["idMitra", "cabangId", "espId"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const { washer, dryer } = body;
  if ((washer === undefined || washer === null) && (dryer === undefined || dryer === null)) return res.status(400).json({ error: "Field washer atau dryer harus diisi" });
  if (washer !== undefined && washer !== null && washer !== 0 && washer !== 1) return res.status(400).json({ error: "Field washer harus bernilai 0 atau 1" });
  if (dryer !== undefined && dryer !== null && dryer !== 0 && dryer !== 1) return res.status(400).json({ error: "Field dryer harus bernilai 0 atau 1" });
  if (washer !== 1 && dryer !== 1) return res.status(400).json({ error: "Minimal salah satu washer atau dryer harus bernilai 1" });
  const createdBy = req.user ? req.user.username || req.user.id : null;
  const result = await MesinModel.createNewMesin(body, createdBy);
  await audit(req, A.CREATE, E.MACHINE_DETAIL, result?.id, null, result);
  return res.status(201).json({ message: "CREATE new Mesin success", data: result });
};

const updateMesin = async (req, res) => {
  const oldValues = await getAuditSnapshot(MesinModel, "getMesinById", req.params.id);
  const { body } = req;
  const updatedBy = req.user ? req.user.username || req.user.id : null;
  const missingFields = getMissingRequiredFields(body, ["idMitra", "cabangId", "espId"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  const { washer, dryer } = body;
  if (washer === undefined || washer === null) return res.status(400).json({ error: "Field washer harus diisi" });
  if (dryer === undefined || dryer === null) return res.status(400).json({ error: "Field dryer harus diisi" });
  if (washer !== 0 && washer !== 1) return res.status(400).json({ error: "Field washer harus bernilai 0 atau 1" });
  if (dryer !== 0 && dryer !== 1) return res.status(400).json({ error: "Field dryer harus bernilai 0 atau 1" });
  const data = await MesinModel.updateMesin(req.params.id, body, updatedBy);
  await audit(req, A.UPDATE, E.MACHINE_DETAIL, req.params.id, oldValues, data);
  return res.status(200).json({ message: "UPDATE Mesin success", data });
};

const deleteMesin = async (req, res) => {
  const oldValues = await getAuditSnapshot(MesinModel, "getMesinById", req.params.id);
  await MesinModel.deleteMesin(req.params.id, req.user.username);
  await audit(req, A.DELETE, E.MACHINE_DETAIL, req.params.id, oldValues, null);
  return res.status(200).json({ message: "Delete Mesin success", data: null });
};

const getMesinById = async (req, res) => res.status(200).json({ message: "get Data Mesin success", data: await MesinModel.getMesinById(req.params.id) });
const getAllMesin = async (req, res) => res.status(200).json({ message: "Get All Mesin success", data: await MesinModel.getAllMesin(req.query.status) });
const getMesinByIdMitra = async (req, res) => res.status(200).json({ success: "Get Mesin by Id Mitra success", data: await MesinModel.getMesinByIdMitra(req.params.idMitra) });
const getMesinByIdCabang = async (req, res) => res.status(200).json({ success: "Get Mesin by Id Cabang success", data: await MesinModel.getMesinByIdCabang(req.params.cabangId) });
const restoreMesin = async (req, res) => { await MesinModel.restoreMesin(req.params.id, req.user.username); await audit(req, A.RESTORE, E.MACHINE_DETAIL, req.params.id, { statusAktif: false }, { statusAktif: true }); return res.status(200).json({ message: "Restore Mesin success", data: null }); };
const getMesinByEspId = async (req, res) => res.status(200).json({ message: "get Data Mesin success", data: await MesinModel.getMesinByEspId(req.params.espId) });

const getListMesinMobile = async (req, res) => {
  const filter = req.query.filter ? String(req.query.filter).toLowerCase() : null;
  if (filter && filter !== "washer" && filter !== "dryer") return res.status(400).json({ error: "Filter harus berisi washer atau dryer" });
  const idMitra = req.user?.idMitra || await MesinModel.getMitraIdByCabangId(req.params.cabangId);
  const data = await MesinModel.getListMesinMobile(req.params.cabangId, idMitra, filter);
  return res.status(200).json({ success: true, data });
};

const getAllMasterMesin = async (req, res) => res.status(200).json({ success: true, data: await MesinModel.getAllMasterMesin() });
const setMaintenance = async (req, res) => { const data = await MesinModel.setMaintenance(req.params.idMesinDetail, req.user ? req.user.username || req.user.id : null); await audit(req, A.STATUS_CHANGE, E.MACHINE_DETAIL, req.params.idMesinDetail, null, { status: "maintenance" }); return res.status(200).json({ success: "Set Mesin to Maintenance Success", data }); };
const setReady = async (req, res) => { const data = await MesinModel.setReady(req.params.idMesinDetail, req.user ? req.user.username || req.user.id : null); await audit(req, A.STATUS_CHANGE, E.MACHINE_DETAIL, req.params.idMesinDetail, null, { status: "ready" }); return res.status(200).json({ success: "Set Mesin to Ready Success", data }); };

module.exports = { createNewMesin, updateMesin, deleteMesin, restoreMesin, getMesinById, getAllMesin, getAllMasterMesin, getMesinByIdMitra, getMesinByIdCabang, getMesinByEspId, getListMesinMobile, setMaintenance, setReady };
