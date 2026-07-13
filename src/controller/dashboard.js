const DashboardModel = require("../models/dashboard");

const getMitra = async (req, res) => {
  try {
    const data = await DashboardModel.getMitra();

    res.status(200).json({
      success: true,
      total: data.length,
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getCabang = async (req, res) => {
  try {
    const data = await DashboardModel.getCabang();

    res.status(200).json({
      success: true,
      total: data.length,
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getMesin = async (req, res) => {
  try {
    const data = await DashboardModel.getMesin();

    res.status(200).json({
      success: "Get Jumlah Mesin Success",
      total: data.total,
      totalWasher: data.totalWasher,
      totalDryer: data.totalDryer,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  getMitra,
  getCabang,
  getMesin,
};
