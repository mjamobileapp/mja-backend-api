const dbPool = require("../config/database");

const getAllRole = () => {
  const SQLQuery = "Select * from tbl_role";
  return dbPool.execute(SQLQuery);
};

const getRoleById = (idRole) => {
  const SQLQuery = "SELECT * FROM tbl_role WHERE id = ?";
  return dbPool.execute(SQLQuery, [idRole]);
};

const createNewRole = (body) => {
  const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

  const SQLQuery = `
    INSERT INTO tbl_role (namaRole, description, createdDate, createdBy)
    VALUES (?, ?, ?, ?)
  `;

  const values = [body.namaRole, body.description, dateNow, body.createdBy];

  return dbPool.execute(SQLQuery, values);
};

const updateRole = (body, idRole) => {
  const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");

  const SQLQuery = `
    UPDATE tbl_role 
    SET namaRole = ?, 
        description = ?, 
        updatedDate = ?, 
        updatedBy = ?
    WHERE id = ?
  `;

  const values = [
    body.namaRole,
    body.description,
    dateNow,
    body.updatedBy,
    idRole,
  ];
  
  return dbPool.execute(SQLQuery, values);
};

const deleteRole = (idRole) => {
  const SQLQuery = "DELETE FROM tbl_role WHERE id = ?";

  return dbPool.execute(SQLQuery, [idRole]);
};

module.exports = {
  getAllRole,
  getRoleById,
  createNewRole,
  updateRole,
  deleteRole,
};
