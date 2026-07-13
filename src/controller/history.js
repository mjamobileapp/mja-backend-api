const HistoryModel = require("../models/history");

const getHistoryTransaksi = async (req, res) => {
  const { cabangId } = req.query;
  const idMitra = req.user ? req.user.idMitra : null;

  if (!cabangId) {
    return res.status(400).json({
      error: "cabangId tidak ditemukan",
    });
  }

  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  try {
    const data = await HistoryModel.getHistoryTransaksi(cabangId, idMitra);
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    if (error.message === "Data tidak ditemukan") {
      return res.status(404).json({
        error: error.message,
      });
    }
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getHistoryTransaksiKasir = async (req, res) => {
  const { tanggal, namaKasir } = req.query;
  const cabangId = req.user ? (req.user.cabang_id || req.user.cabangId) : null;

  if (!cabangId) {
    return res.status(401).json({
      error: "Parameter cabangId diperlukan untuk owner",
    });
  }

  try {
    const data = await HistoryModel.getHistoryTransaksiKasir({
      cabangId,
      tanggal,
      namaKasir,
    });

    res.status(200).json({
      success: "Get Data History Transaksi Kasir Success",
      data: data,
    });
  } catch (error) {
    if (error.message === "Data tidak ditemukan") {
      return res.status(404).json({
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getHistoryMesin = async (req, res) => {
  const { cabangId } = req.query;
  const idMitra = req.user ? req.user.idMitra : null;

  if (!cabangId) {
    return res.status(400).json({
      error: "cabangId tidak ditemukan",
    });
  }

  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  try {
    const data = await HistoryModel.getHistoryMesin(cabangId, idMitra);
    res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    if (error.message === "Data tidak ditemukan") {
      return res.status(404).json({
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
  getHistoryTransaksi,
  getHistoryTransaksiKasir,
  getHistoryMesin,
};
