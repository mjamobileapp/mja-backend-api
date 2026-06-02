const RoleModels = require("../models/roles");
const moment = require("moment");
const getAllRoles = async (req, res) => {
  try {
    const [data] = await RoleModels.getAllRole();
    // console.log(data);
    const mappedData = data.map((item) => ({
      id: item.id,
      namaRole: item.role_name,
      description: item.description,
      cretedDate: item.created_date,
    }));
    res.json({
      message: "Get All Role Success",
      data: mappedData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const getRoleById = async (req, res) => {
  const { idRole } = req.params;
  console.log(idRole);
  try {
    const [data] = await RoleModels.getRoleById(idRole);
    const dataResult = data[0];
    // console.log(data);
    const mappedData = {
      id: dataResult.id,
      namaRole: dataResult.role_name,
      description: dataResult.description,
    };
    res.json({
      message: "Get by Id Role success",
      data: mappedData,
    });
  } catch (error) {
    console.error("Error fetching Role:", error);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

const createNewRole = async (req, res) => {
  var mysqlTimestamp = moment(Date.now()).format("YYYY-MM-DD HH:mm:ss");
  // console.log(req);
  const { body } = req;

  const mapData = {
    namaRole: body.namaRole,
    description: body.description,
    createdBy: body.createdBy,
    createdDate: mysqlTimestamp,
  };

  // console.log(mapData);
  if (!body.namaRole || !body.description || !body.createdBy) {
    return res.status(400).json({
      message: "Anda mengirimkan data yang salah",
      data: null,
    });
  }

  try {
    await RoleModels.createNewRole(mapData);
    res.status(201).json({
      message: "CREATE new Role success",
      data: body,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const updateRole = async (req, res) => {
  const { idRole } = req.params;
  const { body } = req;

  var mysqlTimestamp = moment(Date.now()).format("YYYY-MM-DD HH:mm:ss");
  const mapData = {
    namaRole: body.namaRole,
    description: body.description,
    createdBy: body.createdBy,
    createdDate: mysqlTimestamp,
  };
  try {
    await RoleModels.updateRole(mapData, idRole);
    res.json({
      message: "UPDATE Role success",
      data: {
        id: idRole,
        ...body,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const deleteRole = async (req, res) => {
  const { idRole } = req.params;
  try {
    await RoleModels.deleteRole(idRole);
    res.json({
      message: "DELETE Role success",
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  createNewRole,
  updateRole,
  deleteRole,
};
