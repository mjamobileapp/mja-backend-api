const dbPool = require("../config/database");
const bcrypt = require("bcrypt");

const getAllUser = () => {
  const SQLQuery = `Select 
   mu.id,
   mu.username,
   mu.nama,
   mu.password,
   mu.createdDate,
   mu.createdBy,  
   mu.roleId,
   mr.namaRole 
   From tbl_users as mu
   inner join tbl_role as mr
   on mu.roleId = mr.id
    order by mu.createdDate desc`;
  return dbPool.execute(SQLQuery);
};

const getDataRole = (id) => {
  const SQLQuery = `select * from tbl_role where id=?`;
  return dbPool.execute(SQLQuery, [id]);
};

const getUserById = (id) => {
  const SQLQuery = `Select 
   mu.id,
   mu.username,
   mu.nama,
   mu.roleId,
   mr.namaRole 
   From tbl_users as mu
   inner join tbl_role as mr
   on mu.roleId = mr.id
   where mu.id=?`;
  return dbPool.execute(SQLQuery, [id]);
};

const createNewUser = async (body) => {
  try {
    const dataPegawai = {
      nama: body.nama,
      roleId: body.roleId,
      username: body.username,
      password: body.password,
      createdBy: body.createdBy,
    };

    console.log(dataPegawai);

    if (!body.password) {
      throw new Error("Password is required");
    }

    const hashedPassword = await bcrypt.hash(body.password, 10); // Hash the password
    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = `INSERT INTO tbl_users (
      nama,
      roleId,
      username,
      password,
      createdBy,
      createdDate
     )
      VALUES (?,?,?,?,?,?)`;

    const values = [
      dataPegawai.nama,
      dataPegawai.roleId,
      dataPegawai.username,
      hashedPassword,
      dataPegawai.createdBy,
      dateNow,
    ];
    // console.log(values);
    return dbPool.execute(SQLQuery, values);
  } catch (error) {
    console.error("Failed to create new user:", error.message);
    throw new Error("Failed to create new user: " + error.message);
  }
};

const validateUser = (username) => {
  const SQLQuery = `SELECT * FROM tbl_users WHERE username=?`;
  return dbPool.execute(SQLQuery, [username]);
};

const identitiyUser = (username) => {
  const SQLQuery = `select a.id as id_user, 
a.username, 
a.nama, 
b.id as id_role,
b.namaRole
from tbl_users a inner join tbl_role b
on a.roleId = b.id
where username = ?`;
  return dbPool.execute(SQLQuery, [username]);
};

const updateUser = async (body, id) => {
  try {
    // ambil data body
    const { nama, username, roleId, password, createdBy } = body;

    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");
    // --- cek apakah password diisi ---
    let hashedPassword = null;
    if (password && password.trim() !== "") {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // --- susun query dinamis ---
    // jika password tidak diisi, jangan ubah kolom password
    let SQLQuery = `
      UPDATE tbl_users 
      SET 
        nama = ?, 
        roleId = ?, 
        username = ?, 
        createdBy = ?,
        createdDate = ?
    `;
    const values = [nama, roleId, username, createdBy, dateNow];

    if (hashedPassword) {
      SQLQuery += `, password = ?`;
      values.push(hashedPassword);
    }

    SQLQuery += ` WHERE id = ?`;
    values.push(id);

    console.log("Update query values:", values);

    const [result] = await dbPool.execute(SQLQuery, values);
    return result;
  } catch (error) {
    console.error("Failed to update user:", error.message);
    throw new Error("Failed to update user: " + error.message);
  }
};

const deleteUser = (id) => {
  const SQLQuery = `DELETE FROM tbl_users WHERE id=?`;
  return dbPool.execute(SQLQuery, [id]);
};

module.exports = {
  getAllUser,
  getUserById,
  createNewUser,
  updateUser,
  deleteUser,
  getDataRole,
  validateUser,
  identitiyUser,
};
