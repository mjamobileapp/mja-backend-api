const MasterItemModel = require("../models/masterItem");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");
const { audit, getAuditSnapshot, A, E } = require("../utils/auditBackoffice");

const createMasterItemController = (model = MasterItemModel) => {
  const createNewMasterItem = async (req, res) => {
    const payload = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");
    const missingFields = getMissingRequiredFields(payload, ["namaItem", "tipeItem", "createdBy"]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Bad request, missing required fields",
        missingFields,
      });
    }

    const result = await model.createNewMasterItem(payload);
    await audit(req, A.CREATE, E.MASTER_ITEM, result?.id, null, result);
    return res.status(201).json({ message: "CREATE new Master Item success", data: result });
  };

  const getAllMasterItem = async (req, res) => {
    const data = await model.getAllMasterItem(req.query.status);
    return res.status(200).json({ message: "Get All Master Item success", data });
  };

  const getMasterItemById = async (req, res) => {
    const data = await model.getMasterItemById(req.params.id);
    return res.status(200).json({ message: "Get Master Item by Id success", data });
  };

  const getMasterItemByTipe = async (req, res) => {
    const { tipeItem } = req.params;
    const validTypes = ["stok", "non_stok"];

    if (!validTypes.includes(tipeItem)) {
      return res.status(400).json({ error: "Tipe item tidak valid. Gunakan 'stok' atau 'non_stok'." });
    }

    const data = await model.getMasterItemByTipe(tipeItem);
    return res.status(200).json({ message: "Get by Tipe Item Success", data });
  };

  const updateMasterItem = async (req, res) => {
    const oldValues = await getAuditSnapshot(model, "getMasterItemById", req.params.id);
    const payload = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");
    const missingFields = getMissingRequiredFields(payload, ["namaItem", "tipeItem", "updatedBy"]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Bad request, missing required fields",
        missingFields,
      });
    }

    const data = await model.updateMasterItem(req.params.id, payload);
    await audit(req, A.UPDATE, E.MASTER_ITEM, req.params.id, oldValues, data);
    return res.status(200).json({ message: "UPDATE Master Item success", data });
  };

  const deleteMasterItem = async (req, res) => {
    const oldValues = await getAuditSnapshot(model, "getMasterItemById", req.params.id);
    await model.deleteMasterItem(req.params.id, req.user.username);
    await audit(req, A.DELETE, E.MASTER_ITEM, req.params.id, oldValues, null);
    return res.status(200).json({ message: "Delete Master Item success", data: null });
  };

  const restoreMasterItem = async (req, res) => {
    await model.restoreMasterItem(req.params.id, req.user.username);
    await audit(req, A.RESTORE, E.MASTER_ITEM, req.params.id, null, { statusAktif: true });
    return res.status(200).json({ message: "Restore Master Item success", data: null });
  };

  return {
    createNewMasterItem,
    getAllMasterItem,
    getMasterItemById,
    getMasterItemByTipe,
    updateMasterItem,
    deleteMasterItem,
    restoreMasterItem,
  };
};

module.exports = {
  ...createMasterItemController(),
  createMasterItemController,
};
