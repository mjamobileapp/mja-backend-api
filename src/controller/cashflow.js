const CashflowModel = require("../models/cashflow");

const getCashflow = async (req, res) => {
  const { cabangId } = req.query;
  const { idMitra } = req.user;

  if (!idMitra) {
    return res.status(401).json({
      error: "Token tidak valid",
    });
  }

  if (!cabangId) {
    return res.status(400).json({
      error: "Parameter cabangId diperlukan",
    });
  }

  try {
    const [rows] = await CashflowModel.getCashflow(cabangId, idMitra, cabangId, idMitra);

    let data = {
      totalPemasukan: "0",
      totalPengeluaran: "0",
      sisaKas: "0",
    };

    if (rows && rows.length > 0) {
      data = {
        totalPemasukan: String(rows[0].totalPemasukan),
        totalPengeluaran: String(rows[0].totalPengeluaran),
        sisaKas: String(rows[0].sisaKas),
      };
    }

    res.json({
      message: "Get Data Cashflow Success",
      data: data,
    });
  } catch (error) {
    console.error("Error fetching cashflow:", error);
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getPendapatan = async (req, res) => {
  const { cabangId } = req.query;
  const idMitra = req.user ? req.user.idMitra : null;

  console.log("GET PENDAPATAN REQUEST:", { cabangId, idMitra });

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
    const data = await CashflowModel.getPendapatan(cabangId, idMitra);
    res.status(200).json({
      success: "Get Data Pendapatan Success",
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
  getCashflow,
  getPendapatan,
};