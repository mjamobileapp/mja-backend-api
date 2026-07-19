const DashboardModel = require("../models/dashboard");

const getMitra = async (req, res) => {
  const data = await DashboardModel.getMitra();

  return res.status(200).json({
    success: true,
    total: data.length,
    data: data,
  });
};

const getCabang = async (req, res) => {
  const data = await DashboardModel.getCabang();

  return res.status(200).json({
    success: true,
    total: data.length,
    data: data,
  });
};

const getMesin = async (req, res) => {
  const data = await DashboardModel.getMesin();

  return res.status(200).json({
    success: "Get Jumlah Mesin Success",
    total: data.total,
    totalWasher: data.totalWasher,
    totalDryer: data.totalDryer,
  });
};

module.exports = {
  getMitra,
  getCabang,
  getMesin,
};
