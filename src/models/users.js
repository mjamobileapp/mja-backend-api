const dbPool = require("../config/database");
const bcrypt = require("bcrypt");

const getAllUser = (status) => {
  let SQLQuery = `Select 
   mu.id,
   mu.username,
   mu.nama,
   mu.password,
   mu.createdDate,
   mu.createdBy,  
   mu.statusAktif,
   mu.roleId,
   mr.namaRole 
   From tbl_users as mu
   inner join tbl_role as mr
   on mu.roleId = mr.id
  `;

  if (status === "all") {
    // Ambil semua data tanpa filter statusAktif
  } else if (status === "inactive") {
    SQLQuery += " WHERE mu.statusAktif = 0";
  } else {
    SQLQuery += " WHERE mu.statusAktif = 1";
  }

  SQLQuery += " order by mu.createdDate desc";
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
   mu.statusAktif,
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
      statusAktif: true,
    };

    console.log(dataPegawai);

    if (!body.password) {
      throw new Error("Password is required");
    }

    const [existingUser] = await dbPool.execute(
      "SELECT id FROM tbl_users WHERE username = ?",
      [dataPegawai.username]
    );

    if (existingUser.length > 0) {
      throw new Error("User sudah terdaftar");
    }

    const hashedPassword = await bcrypt.hash(body.password, 10); // Hash the password
    const dateNow = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = `INSERT INTO tbl_users (
      nama,
      roleId,
      username,
      password,
      createdBy,
      createdDate,
      statusAktif
     )
      VALUES (?,?,?,?,?,?,?)`;

    const values = [
      dataPegawai.nama,
      dataPegawai.roleId,
      dataPegawai.username,
      hashedPassword,
      dataPegawai.createdBy,
      dateNow,
      dataPegawai.statusAktif,
    ];
    // console.log(values);
    await dbPool.execute(SQLQuery, values);
    return { ...body, statusAktif: true };
  } catch (error) {
    console.error("Failed to create new user:", error.message);
    throw error;
  }
};

const validateUser = (username) => {
  const SQLQuery = `SELECT * FROM tbl_users WHERE username=? AND statusAktif = 1`;
  return dbPool.execute(SQLQuery, [username]);
};

const identitiyUser = (username) => {
  const SQLQuery = `select a.id as id_user, 
a.username, 
a.nama, 
a.statusAktif,
b.id as id_role,
b.namaRole
from tbl_users a inner join tbl_role b
on a.roleId = b.id
where username = ? AND a.statusAktif = 1`;
  return dbPool.execute(SQLQuery, [username]);
};

const updateUser = async (body, id) => {
  try {
    // ambil data body
    const { nama, username, roleId, password, updatedBy } = body;

    const [existingUser] = await dbPool.execute(
      "SELECT username FROM tbl_users WHERE id = ? AND statusAktif = 1",
      [id]
    );

    if (existingUser.length === 0) {
      throw new Error("data not found");
    }

    if (username !== existingUser[0].username) {
      const [duplicate] = await dbPool.execute(
        "SELECT id FROM tbl_users WHERE username = ? AND id != ?",
        [username, id]
      );

      if (duplicate.length > 0) {
        throw new Error("User sudah terdaftar");
      }
    }

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
        updatedBy = ?,
        updatedDate = ?
    `;
    const values = [nama, roleId, username, updatedBy, dateNow];

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
    throw error;
  }
};

const deleteUser = async (id, updatedBy) => {
  try {
    const [existingUser] = await dbPool.execute(
      "SELECT id FROM tbl_users WHERE id = ? AND statusAktif = 1",
      [id]
    );

    if (existingUser.length === 0) {
      throw new Error("data not found");
    }

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_users SET statusAktif = 0, updatedBy = ?, updatedDate = ? WHERE id = ?";
    return dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

const restoreUser = async (id, updatedBy) => {
  try {
    const [existingUser] = await dbPool.execute(
      "SELECT id FROM tbl_users WHERE id = ? AND statusAktif = 0",
      [id]
    );

    if (existingUser.length === 0) {
      throw new Error("data not found");
    }

    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");
    const SQLQuery = "UPDATE tbl_users SET statusAktif = 1, updatedBy = ?, updatedDate = ? WHERE id = ?";
    return dbPool.execute(SQLQuery, [updatedBy, updatedDate, id]);
  } catch (error) {
    throw error;
  }
};

const changePassword = async (id, body, updatedBy) => {
  try {
    const { oldPassword, newPassword } = body;

    // 1. Ambil data user termasuk password hashed
    const [rows] = await dbPool.execute(
      "SELECT id, username, password FROM tbl_users WHERE id = ? AND statusAktif = 1",
      [id]
    );

    if (rows.length === 0) throw new Error("data not found");

    const user = rows[0];

    // 2. Verifikasi password lama
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new Error("Password lama salah");
    }

    // 3. Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    // 4. Update password di database
    const SQLQuery = "UPDATE tbl_users SET password = ?, updatedBy = ?, updatedDate = ? WHERE id = ?";
    await dbPool.execute(SQLQuery, [hashedPassword, updatedBy, updatedDate, id]);

    return user.username;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getAllUser,
  getUserById,
  createNewUser,
  updateUser,
  deleteUser,
  restoreUser,
  getDataRole,
    validateUser,
  identitiyUser,
  changePassword,
};
