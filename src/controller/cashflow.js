const CashflowModel = require("../models/cashflow");
const { getMissingRequiredFields } = require("../utils/validation");

const getRequestDateFilter = (req) => req.query.filter ?? req.query.periode ?? req.query.tanggal ?? "";
const getExpenseScope = (req, res) => {
  const idMitra = req.user?.idMitra;
  const role = String(req.user?.role || "").toLowerCase();
  if (!idMitra) { res.status(401).json({ error: "Token tidak valid" }); return null; }
  if (role === "owner") return { idMitra, cabangId: null, role };
  if (role === "kasir") {
    const cabangId = req.user?.cabang_id || req.user?.cabangId;
    if (!cabangId) { res.status(403).json({ error: "Cabang kasir tidak ditemukan di token" }); return null; }
    return { idMitra, cabangId, role };
  }
  res.status(403).json({ error: "Role tidak diizinkan mengakses pengeluaran" }); return null;
};

const getCashflow = async (req, res) => {
  const { cabangId } = req.query; const idMitra = req.user?.idMitra;
  if (!idMitra) return res.status(401).json({ error: "Token tidak valid" });
  if (!cabangId) return res.status(400).json({ error: "Parameter cabangId diperlukan" });
  const [rows] = await CashflowModel.getCashflow(cabangId, idMitra, cabangId, idMitra, getRequestDateFilter(req));
  const row = rows?.[0];
  return res.json({ message: "Get Data Cashflow Success", data: { totalPemasukan: String(row?.totalPemasukan ?? 0), totalPengeluaran: String(row?.totalPengeluaran ?? 0), sisaKas: String(row?.sisaKas ?? 0) } });
};
const getPendapatan = async (req, res) => {
  if (!req.query.cabangId) return res.status(400).json({ error: "cabangId tidak ditemukan" });
  if (!req.user?.idMitra) return res.status(400).json({ error: "idMitra tidak ditemukan di token" });
  return res.status(200).json({ success: "Get Data Pendapatan Success", data: await CashflowModel.getPendapatan(req.query.cabangId, req.user.idMitra, getRequestDateFilter(req)) });
};

const getListPengeluaran = async (req, res) => {
  const scope = getExpenseScope(req, res); if (!scope) return;
  const requested = req.query.cabangId; const filter = getRequestDateFilter(req);
  if (scope.role === "kasir") {
    if (requested && Number(requested) !== Number(scope.cabangId)) return res.status(403).json({ error: "Kasir hanya dapat mengakses pengeluaran cabangnya sendiri" });
    return res.status(200).json({ success: "Get Data List Expense Success", data: await CashflowModel.getListPengeluaran(scope.cabangId, scope.idMitra, filter) });
  }
  if (!requested) return res.status(400).json({ error: "cabangId tidak ditemukan" });
  if (!await CashflowModel.isCabangOwnedByMitra(requested, scope.idMitra)) return res.status(403).json({ error: "Cabang tidak dapat diakses oleh mitra ini" });
  return res.status(200).json({ success: "Get Data Pengeluaran Success", data: await CashflowModel.getPengeluaran(requested, scope.idMitra, filter) });
};
const getPengeluaranById = async (req, res) => {
  const scope = getExpenseScope(req, res); if (!scope) return;
  return res.json({ message: "Get Data Expense success", data: await CashflowModel.getPengeluaranById(req.params.id, scope.idMitra, getRequestDateFilter(req), scope.cabangId) });
};

const createPengeluaran = async (req, res) => {
  const { itemId, jumlahBarang, nominal } = req.body;
  const idMitra = req.user?.idMitra; const cabangId = req.user?.cabang_id || req.user?.cabangId; const idUserMobile = req.user?.id;
  if (!idMitra) return res.status(400).json({ error: "idMitra tidak ditemukan di token" });
  if (!cabangId) return res.status(400).json({ error: "cabangId tidak ditemukan di token" });
  if (!idUserMobile) return res.status(400).json({ error: "idUserMobile tidak ditemukan di token" });
  if (!itemId) return res.status(400).json({ error: "itemId wajib diisi" });
  if (!nominal || nominal <= 0) return res.status(400).json({ error: "nominal wajib diisi dan harus lebih dari 0" });
  const data = await CashflowModel.createPengeluaran({ idMitra, cabangId, idUserMobile, itemId, jumlahBarang: jumlahBarang || 0, nominal });
  return res.status(201).json({ success: "Create Data List Expense Success", data });
};
const updatePengeluaran = async (req, res) => {
  const scope = getExpenseScope(req, res); if (!scope) return;
  const missingFields = getMissingRequiredFields(req.body, ["itemId", "jumlahBarang", "nominal"]);
  if (missingFields.length > 0) return res.status(400).json({ message: "Bad request, missing required fields", missingFields });
  if (req.body.nominal <= 0) return res.status(400).json({ error: "nominal wajib diisi dan harus lebih dari 0" });
  const data = await CashflowModel.updatePengeluaran(req.body, req.params.id, scope.idMitra, scope.cabangId);
  return res.json({ message: "UPDATE Data Expense success", data });
};
const deletePengeluaran = async (req, res) => {
  const scope = getExpenseScope(req, res); if (!scope) return;
  await CashflowModel.deletePengeluaran(req.params.id, scope.idMitra, scope.cabangId);
  return res.json({ message: "Delete Mitra success", data: null });
};

module.exports = { getCashflow, getPendapatan, getListPengeluaran, getPengeluaranById, createPengeluaran, updatePengeluaran, deletePengeluaran };
