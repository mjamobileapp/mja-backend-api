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

  const data = await HistoryModel.getHistoryTransaksi(cabangId, idMitra);
  return res.status(200).json({
    success: true,
    data: data,
  });
};

const getHistoryTransaksiKasir = async (req, res) => {
  const { tanggal, namaKasir } = req.query;
  const cabangId = req.user ? (req.user.cabang_id || req.user.cabangId) : null;

  if (!cabangId) {
    return res.status(401).json({
      error: "Parameter cabangId diperlukan untuk owner",
    });
  }

  const data = await HistoryModel.getHistoryTransaksiKasir({
    cabangId,
    tanggal,
    namaKasir,
  });

  return res.status(200).json({
    success: "Get Data History Transaksi Kasir Success",
    data: data,
  });
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

  const data = await HistoryModel.getHistoryMesin(cabangId, idMitra);
  return res.status(200).json({
    success: true,
    data: data,
  });
};

module.exports = {
  getHistoryTransaksi,
  getHistoryTransaksiKasir,
  getHistoryMesin,
};
