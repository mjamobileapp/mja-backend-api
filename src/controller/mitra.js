const MitraModel = require("../models/mitra");

const createNewMitra = async (req, res) => {
  const { body } = req;
  console.log("BODY REQUEST:", body);

  if (!body.kodeMitra || !body.namaMitra || !body.createdBy) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
    });
  }

  try {
    await MitraModel.createNewMitra(body);
        res.status(201).json({
      message: "CREATE new Mitra success",
      data: {
        kodeMitra: body.kodeMitra,
        namaMitra: body.namaMitra,
        createdBy: body.createdBy,
      },
    });
  } catch (error) {
    if (error.message === "Mitra sudah terdaftar") {
      return res.status(400).json({
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  createNewMitra,
};
