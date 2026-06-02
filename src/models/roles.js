const dbPool = require("../config/database");

const getAllRole = () => {
  const SQLQuery = "Select * from tbl_role";
  return dbPool.execute(SQLQuery);
};

const getRoleById = (idRole) => {
  const SQLQuery = `select * from tbl_role where id=${idRole}`;
  return dbPool.execute(SQLQuery);
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
        createdDate = ?, 
        createdBy = ?
    WHERE id = ?
  `;

  const values = [
    body.namaRole,
    body.description,
    dateNow,
    body.createdBy,
    idRole,
  ];

  return dbPool.execute(SQLQuery, values);
};

const deleteRole = (idRole) => {
  const SQLQuery = `Delete from tbl_role 
    where id=${idRole}`;

  return dbPool.execute(SQLQuery);
};

module.exports = {
  getAllRole,
  getRoleById,
  createNewRole,
  updateRole,
  deleteRole,
};
