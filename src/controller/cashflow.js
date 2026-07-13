const CashflowModel = require("../models/cashflow");
const { getMissingRequiredFields } = require("../utils/validation");

const getRequestDateFilter = (req) => req.query.filter ?? req.query.periode ?? req.query.tanggal ?? "";

const getExpenseScope = (req, res) => {
  const idMitra = req.user?.idMitra;
  const role = String(req.user?.role || "").toLowerCase();

  if (!idMitra) {
    res.status(401).json({ error: "Token tidak valid" });
    return null;
  }

  if (role === "owner") {
    return { idMitra, cabangId: null, role };
  }

  if (role === "kasir") {
    const cabangId = req.user?.cabang_id || req.user?.cabangId;
    if (!cabangId) {
      res.status(403).json({ error: "Cabang kasir tidak ditemukan di token" });
      return null;
    }

    return { idMitra, cabangId, role };
  }

  res.status(403).json({ error: "Role tidak diizinkan mengakses pengeluaran" });
  return null;
};

const getCashflow = async (req, res) => {
  const { cabangId } = req.query;
  const filter = getRequestDateFilter(req);
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
  const filter = getRequestDateFilter(req);
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
  const requestedCabangId = req.query.cabangId;
  const filter = getRequestDateFilter(req);
  const scope = getExpenseScope(req, res);

  if (!scope) return;

  const { idMitra, role } = scope;
  let cabangId = requestedCabangId;

  if (role === "kasir") {
    if (requestedCabangId && Number(requestedCabangId) !== Number(scope.cabangId)) {
      return res.status(403).json({ error: "Kasir hanya dapat mengakses pengeluaran cabangnya sendiri" });
    }

    try {
      const data = await CashflowModel.getListPengeluaran(scope.cabangId, idMitra, filter);
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

  if (!cabangId) {
    return res.status(400).json({
      error: "cabangId tidak ditemukan",
    });
  }

  try {
    const isOwnedCabang = await CashflowModel.isCabangOwnedByMitra(cabangId, idMitra);
    if (!isOwnedCabang) {
      return res.status(403).json({ error: "Cabang tidak dapat diakses oleh mitra ini" });
    }

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
  const filter = getRequestDateFilter(req);
  const scope = getExpenseScope(req, res);

  if (!scope) return;

  try {
    const data = await CashflowModel.getPengeluaranById(id, scope.idMitra, filter, scope.cabangId);

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
  const scope = getExpenseScope(req, res);

  if (!scope) return;

  const missingFields = getMissingRequiredFields(body, ["itemId", "jumlahBarang", "nominal"]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  if (!scope) return;

  if (body.nominal <= 0) {
    return res.status(400).json({
      error: "nominal wajib diisi dan harus lebih dari 0",
    });
  }

  try {
    const data = await CashflowModel.updatePengeluaran(body, id, scope.idMitra, scope.cabangId);

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
  const scope = getExpenseScope(req, res);

  try {
    await CashflowModel.deletePengeluaran(id, scope.idMitra, scope.cabangId);

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
