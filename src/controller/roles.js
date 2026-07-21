const RoleModels = require("../models/roles");
const { getDatabaseTimestamp } = require("../utils/date");
const { getMissingRequiredFields, withAuthenticatedAuditUsername } = require("../utils/validation");
const { audit, getAuditSnapshot, A, E } = require("../utils/auditBackoffice");

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
  await audit(req, A.READ, E.ROLE, null, null, { count: mappedData.length });
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
  await audit(req, A.READ, E.ROLE, idRole, null, mappedData);
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

  const missingFields = getMissingRequiredFields(body, ["namaRole", "description", "createdBy"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  const resultTuple = await RoleModels.createNewRole(mapData);
  const result = resultTuple?.[0] || {};
  await audit(req, A.CREATE, E.ROLE, result.insertId, null, { id: result.insertId, namaRole: body.namaRole, description: body.description });
  return res.status(201).json({
    message: "CREATE new Role success",
    data: body,
  });
};

const updateRole = async (req, res) => {
  const idRole = getValidatedRoleId(req, res);
  if (!idRole) return;
  const oldValues = await getAuditSnapshot(RoleModels, "getRoleById", idRole);

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
  await audit(req, A.UPDATE, E.ROLE, idRole, oldValues, { id: idRole, namaRole: body.namaRole, description: body.description });
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

  const oldValues = await getAuditSnapshot(RoleModels, "getRoleById", idRole);
  await RoleModels.deleteRole(idRole);
  await audit(req, A.DELETE, E.ROLE, idRole, oldValues, null);
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
