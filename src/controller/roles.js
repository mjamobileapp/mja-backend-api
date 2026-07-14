const RoleModels = require("../models/roles");
const { getDatabaseTimestamp } = require("../utils/date");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");

const getValidatedRoleId = (req, res) => {
  const rawId = String(req.params?.idRole || "");

  if (!/^[1-9]\d*$/.test(rawId)) {
    res.status(400).json({ message: "idRole harus berupa integer positif" });
    return null;
  }

  const idRole = Number(rawId);
  if (!Number.isSafeInteger(idRole)) {
    res.status(400).json({ message: "idRole harus berupa integer positif" });
    return null;
  }

  return idRole;
};

const getAllRoles = async (req, res) => {
  const [data] = await RoleModels.getAllRole();
  const mappedData = data.map((item) => ({
    id: item.id,
    namaRole: item.namaRole,
    description: item.description,
    cretedDate: item.created_date,
  }));
  return res.json({
    message: "Get All Role Success",
    data: mappedData,
  });
};

const getRoleById = async (req, res) => {
  const idRole = getValidatedRoleId(req, res);
  if (!idRole) return;

  const [data] = await RoleModels.getRoleById(idRole);
  const dataResult = data[0];
  const mappedData = {
    id: dataResult.id,
    namaRole: dataResult.namaRole,
    description: dataResult.description,
  };
  return res.json({
    message: "Get by Id Role success",
    data: mappedData,
  });
};

const createNewRole = async (req, res) => {
  const body = withAuthenticatedAuditUsername(req.body, req.user, "createdBy");

  const mapData = {
    namaRole: body.namaRole,
    description: body.description,
    createdBy: body.createdBy,
    createdDate: getDatabaseTimestamp(),
  };

  // console.log(mapData);
  const missingFields = getMissingRequiredFields(body, ["namaRole", "description", "createdBy"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  await RoleModels.createNewRole(mapData);
  return res.status(201).json({
    message: "CREATE new Role success",
    data: body,
  });
};

const updateRole = async (req, res) => {
  const idRole = getValidatedRoleId(req, res);
  if (!idRole) return;

  const body = withAuthenticatedAuditUsername(req.body, req.user, "updatedBy");

  const mapData = {
    namaRole: body.namaRole,
    description: body.description,
    updatedBy: body.updatedBy,
    updatedDate: getDatabaseTimestamp(),
  };
  const missingFields = getMissingRequiredFields(body, ["namaRole", "description", "updatedBy"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  await RoleModels.updateRole(mapData, idRole);
  return res.json({
    message: "UPDATE Role success",
    data: {
      id: idRole,
      ...body,
    },
  });
};

const deleteRole = async (req, res) => {
  const idRole = getValidatedRoleId(req, res);
  if (!idRole) return;

  await RoleModels.deleteRole(idRole);
  return res.json({
    message: "DELETE Role success",
    data: null,
  });
};

module.exports = {
  getAllRoles,
  getRoleById,
  createNewRole,
  updateRole,
  deleteRole,
};
