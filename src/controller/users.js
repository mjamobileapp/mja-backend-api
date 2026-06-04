const UsersModel = require("../models/users");
const bcrypt = require("bcrypt"); // Ensure bcrypt is installed
const { generateToken } = require("../utils/jwt");

const getAllUsers = async (req, res) => {
  try {
    const [data] = await UsersModel.getAllUser();
    console.log(data);
    const mappedData = data.map((data) => ({
      id: data.id,
      nama: data.nama,
      idRole: data.id_role,
      namaRole: data.role_name,
      username: data.username,
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
    // console.log(dataResult);
    const mappedData = {
      id: dataResult.id,
      nama: dataResult.nama,
      idRole: dataResult.id_role,
      namaRole: dataResult.role_name,
      username: dataResult.username,
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
  if (!body.nama || !body.username) {
    return res.status(400).json({
      message: "All fields are required",
    });
  }

  try {
    await UsersModel.createNewUser(body);
    res.status(201).json({
      message: "CREATE new User success",
      data: body,
    });
  } catch (error) {
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
        role: dataUser.role_name,
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

  try {
    await UsersModel.updateUser(body, id);
    res.json({
      message: "UPDATE Users success",
      data: {
        id: id,
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

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await UsersModel.deleteUser(id);
    res.json({
      message: "DELETE Users success",
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
  getAllUsers,
  getUserById,
  createNewUser,
  updateUser,
  deleteUser,
  loginUser,
};
