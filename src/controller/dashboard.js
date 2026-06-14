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
    console.error("Dashboard Controller Error (getMitra):", error);
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
    console.error("Dashboard Controller Error (getCabang):", error);
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
      success: true,
      total: data.length,
      data: data,
    });
  } catch (error) {
    console.error("Dashboard Controller Error (getMesin):", error);
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