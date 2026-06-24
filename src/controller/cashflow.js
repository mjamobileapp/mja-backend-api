const CashflowModel = require("../models/cashflow");

const getDateFilter = (req) => req.query.filter || req.query.periode || req.query.tanggal || "hari_ini";

const getCashflow = async (req, res) => {
  const { cabangId } = req.query;
  const filter = getDateFilter(req);
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
    const [rows] = await CashflowModel.getCashflow(cabangId, idMitra, cabangId, idMitra, filter);

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
  const filter = getDateFilter(req);
  const idMitra = req.user ? req.user.idMitra : null;

  console.log("GET PENDAPATAN REQUEST:", { cabangId, idMitra, filter });

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
    const data = await CashflowModel.getPendapatan(cabangId, idMitra, filter);
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

const getListPengeluaran = async (req, res) => {
  let { cabangId } = req.query;
  const filter = getDateFilter(req);
  const idMitra = req.user ? req.user.idMitra : null;

  // Jika tidak ada cabangId di query params, anggap user adalah KASIR
  // Ambil cabangId dari token
  if (!cabangId) {
    cabangId = req.user.cabang_id || req.user.cabangId;
    console.log("GET PENGELUARAN (KASIR):", { cabangId, idMitra, filter });

    if (!cabangId) {
      return res.status(400).json({
        error: "cabangId tidak ditemukan",
      });
    }

    try {
      const data = await CashflowModel.getListPengeluaran(cabangId, filter);
      return res.status(200).json({
        success: "Get Data List Expense Success",
        data: data,
      });
    } catch (error) {
      if (error.message === "Data tidak ditemukan") {
        return res.status(404).json({
          error: error.message,
        });
      }
      return res.status(500).json({
        message: "Server Error",
        serverMessage: error.message,
      });
    }
  }

  // OWNER: ada cabangId di query params, gunakan grouping per tanggal
  console.log("GET PENGELUARAN (OWNER):", { cabangId, idMitra, filter });

  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  try {
    const data = await CashflowModel.getPengeluaran(cabangId, idMitra, filter);
    res.status(200).json({
      success: "Get Data Pengeluaran Success",
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

const getPengeluaranById = async (req, res) => {
  const { id } = req.params;
  const filter = getDateFilter(req);
  const idMitra = req.user ? req.user.idMitra : null;

  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  try {
    const data = await CashflowModel.getPengeluaranById(id, idMitra, filter);

    res.json({
      message: "Get Data Expense success",
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

const createPengeluaran = async (req, res) => {
  const { itemId, jumlahBarang, nominal } = req.body;

  // Ambil data dari token
  const idMitra = req.user ? req.user.idMitra : null;
  const cabangId = req.user ? (req.user.cabang_id || req.user.cabangId) : null;
  const idUserMobile = req.user ? req.user.id : null;

  console.log("CREATE PENGELUARAN REQUEST:", { idMitra, cabangId, idUserMobile, itemId, jumlahBarang, nominal });

  // Validasi idMitra dari token
  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  // Validasi cabangId dari token
  if (!cabangId) {
    return res.status(400).json({
      error: "cabangId tidak ditemukan di token",
    });
  }

  // Validasi idUserMobile dari token
  if (!idUserMobile) {
    return res.status(400).json({
      error: "idUserMobile tidak ditemukan di token",
    });
  }

  // Validasi itemId
  if (!itemId) {
    return res.status(400).json({
      error: "itemId wajib diisi",
    });
  }

  // Validasi nominal
  if (!nominal || nominal <= 0) {
    return res.status(400).json({
      error: "nominal wajib diisi dan harus lebih dari 0",
    });
  }

  try {
    const data = await CashflowModel.createPengeluaran({
      idMitra,
      cabangId,
      idUserMobile,
      itemId,
      jumlahBarang: jumlahBarang || 0,
      nominal,
    });

    res.status(201).json({
      success: "Create Data List Expense Success",
      data: data,
    });
  } catch (error) {
    if (
      error.message === "Mitra tidak ditemukan" ||
      error.message === "Cabang tidak ditemukan" ||
      error.message === "User tidak ditemukan" ||
      error.message === "Item tidak ditemukan"
    ) {
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

const updatePengeluaran = async (req, res) => {
  const { id } = req.params;
  const { body } = req;
  const idMitra = req.user ? req.user.idMitra : null;

  const requiredFields = ["itemId", "jumlahBarang", "nominal"];
  const missingFields = requiredFields.filter((field) => body[field] === undefined || body[field] === null || body[field] === "");

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  if (body.nominal <= 0) {
    return res.status(400).json({
      error: "nominal wajib diisi dan harus lebih dari 0",
    });
  }

  try {
    const data = await CashflowModel.updatePengeluaran(body, id, idMitra);

    res.json({
      message: "UPDATE Data Expense success",
      data: data,
    });
  } catch (error) {
    if (
      error.message === "data not found" ||
      error.message === "Item tidak ditemukan"
    ) {
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

const deletePengeluaran = async (req, res) => {
  const { id } = req.params;
  const idMitra = req.user ? req.user.idMitra : null;

  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  try {
    await CashflowModel.deletePengeluaran(id, idMitra);

    res.json({
      message: "Delete Mitra success",
      data: null,
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
  getListPengeluaran,
  getPengeluaranById,
  createPengeluaran,
  updatePengeluaran,
  deletePengeluaran,
};
