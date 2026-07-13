const MasterItemModel = require("../models/masterItem");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");

const sendServerError = (res, error) =>
  res.status(500).json({ message: "Server Error", serverMessage: error.message });

const sendKnownError = (res, error) => {
  if (error.statusCode === 404 || error.statusCode === 409) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  return sendServerError(res, error);
};

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

    try {
      const result = await model.createNewMasterItem(payload);
      return res.status(201).json({ message: "CREATE new Master Item success", data: result });
    } catch (error) {
      return sendKnownError(res, error);
    }
  };

  const getAllMasterItem = async (req, res) => {
    try {
      const data = await model.getAllMasterItem(req.query.status);
      return res.status(200).json({ message: "Get All Master Item success", data });
    } catch (error) {
      return sendServerError(res, error);
    }
  };

  const getMasterItemById = async (req, res) => {
    try {
      const data = await model.getMasterItemById(req.params.id);
      return res.status(200).json({ message: "Get Master Item by Id success", data });
    } catch (error) {
      return sendKnownError(res, error);
    }
  };

  const getMasterItemByTipe = async (req, res) => {
    const { tipeItem } = req.params;
    const validTypes = ["stok", "non_stok"];

    if (!validTypes.includes(tipeItem)) {
      return res.status(400).json({ error: "Tipe item tidak valid. Gunakan 'stok' atau 'non_stok'." });
    }

    try {
      const data = await model.getMasterItemByTipe(tipeItem);
      return res.status(200).json({ message: "Get by Tipe Item Success", data });
    } catch (error) {
      return sendKnownError(res, error);
    }
  };

  const updateMasterItem = async (req, res) => {
    const payload = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");
    const missingFields = getMissingRequiredFields(payload, ["namaItem", "tipeItem", "updatedBy"]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Bad request, missing required fields",
        missingFields,
      });
    }

    try {
      const data = await model.updateMasterItem(req.params.id, payload);
      return res.status(200).json({ message: "UPDATE Master Item success", data });
    } catch (error) {
      return sendKnownError(res, error);
    }
  };

  const deleteMasterItem = async (req, res) => {
    try {
      await model.deleteMasterItem(req.params.id, req.user.username);
      return res.status(200).json({ message: "Delete Master Item success", data: null });
    } catch (error) {
      return sendKnownError(res, error);
    }
  };

  const restoreMasterItem = async (req, res) => {
    try {
      await model.restoreMasterItem(req.params.id, req.user.username);
      return res.status(200).json({ message: "Restore Master Item success", data: null });
    } catch (error) {
      return sendKnownError(res, error);
    }
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
