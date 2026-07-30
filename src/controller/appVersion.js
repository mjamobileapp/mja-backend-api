const AppVersionModel = require("../models/appVersion");
const AppVersionService = require("../services/appVersion");
const { normalizeAppVersionPayload, mapAppVersionRows } = require("../domain/appVersion");

const createAppVersionController = ({ model = AppVersionModel, service = AppVersionService } = {}) => {
  const getAppVersions = async (req, res) => {
    const rows = await model.getAllAppVersions();
    return res.status(200).json({ success: true, data: mapAppVersionRows(rows) });
  };

  const updateAppVersions = async (req, res) => {
    const payload = normalizeAppVersionPayload(req.body);
    if (payload.missingFields) {
      return res.status(400).json({
        message: "Bad request, missing required fields",
        missingFields: payload.missingFields,
      });
    }

    const data = await service.updateAppVersions({
      versions: payload.versions,
      updatedBy: req.user.username,
      auditEvent: { req, actor: req.user },
    });

    return res.status(200).json({ message: "CREATE new APP Version success", data });
  };

  return { getAppVersions, updateAppVersions };
};

module.exports = { ...createAppVersionController(), createAppVersionController };
