const UsersModel = require("../models/users");
const bcrypt = require("bcrypt"); // Ensure bcrypt is installed
const { generateToken } = require("../utils/jwt");

const getAllUsers = async (req, res) => {
  const { status } = req.query;
  try {
    const [data] = await UsersModel.getAllUser(status);
    console.log(data);
    const mappedData = data.map((data) => ({
      id: data.id,
      nama: data.nama,
      idRole: data.roleId,
      namaRole: data.namaRole,
      username: data.username,
      statusAktif: data.statusAktif,
    }));
    res.json({
      message: "GET all Master User success",
      data: mappedData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params;
  // console.log(id);
  try {
    const [data] = await UsersModel.getUserById(id);
    const dataResult = data[0];

    if (!dataResult) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const mappedData = {
      id: dataResult.id,
      nama: dataResult.nama,
      idRole: dataResult.roleId,
      namaRole: dataResult.namaRole,
      username: dataResult.username,
      statusAktif: dataResult.statusAktif,
    };
    // console.log(mappedData);
    res.json({
      message: "Get by Id User success",
      data: mappedData,
    });
  } catch (error) {
    console.error("Error fetching Users:", error);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

const createNewUser = async (req, res) => {
  const { body } = req;

    // Validate required fields
  const requiredFields = ['nama', 'username', 'password', 'roleId', 'createdBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    const data = await UsersModel.createNewUser(body);
    res.status(201).json({
      message: "CREATE new User success",
      data: data,
    });
  } catch (error) {
    if (error.message === "User sudah terdaftar") {
      return res.status(400).json({
        error: error.message,
      });
    }

    console.error("Failed to create new user:", error.message);
    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const loginUser = async (req, res) => {
  const { username, password } = req.body;
  try {
    const [user] = await UsersModel.validateUser(username);
    if (user.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const [dataUser_] = await UsersModel.identitiyUser(username);
    if (dataUser_.length === 0) {
      return res.status(401).json({ message: "user belum mempunyai role" });
    }

    const dataUser = dataUser_[0];
    // console.log(dataUser);
    const token = generateToken(dataUser);

    // return res.json({
    //   token,
    //   //   user: { id: user.id, email: user.email, role_id: user.role_id },
    // });

    res.json({
      message: "Login successful",
      data: {
        id: dataUser.id_user,
        username: dataUser.username,
        nama: dataUser.nama,
        role: dataUser.namaRole,
        statusAktif: dataUser.statusAktif,
        token: token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server Error", serverMessage: error });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { body } = req;

    const requiredFields = ['nama', 'username', 'roleId', 'updatedBy'];
  const missingFields = requiredFields.filter(field => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  try {
    await UsersModel.updateUser(body, id);
    res.json({
      message: "UPDATE Users success",
      data: {
        id: id,
        ...body,
        statusAktif: true,
      },
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }

    if (error.message === "User sudah terdaftar") {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;
  try {
    await UsersModel.deleteUser(id, username);
    res.json({
      message: "DELETE Users success",
      data: null,
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

const restoreUser = async (req, res) => {
  const { id } = req.params;
  const username = req.user.username;
  try {
    await UsersModel.restoreUser(id, username);
    res.json({
      message: "RESTORE Users success",
      data: null,
    });
  } catch (error) {
    if (error.message === "data not found") {
      return res.status(404).json({
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Server Error",
      serverMessage: error,
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createNewUser,
  updateUser,
  deleteUser,
  restoreUser,
  loginUser,
};
