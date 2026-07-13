const TransaksiModel = require("../models/transaksi");

const validJenisLayanan = ["cuci", "kering", "addon_barang"];

const isPositiveNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
};

const isNonNegativeNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0;
};

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const getRequestDateFilter = (req) => req.query.filter ?? req.query.periode ?? req.query.tanggal ?? "";

const getMachineControlContext = async (req) => {
  const actor = req.machineControlActor;
  let idMitra;
  let cabangId;

  if (actor?.type === "owner") {
    idMitra = Number(req.user.idMitra);
    cabangId = Number(req.body.cabangId);

    if (req.body.idMitra !== undefined && Number(req.body.idMitra) !== idMitra) {
      return { statusCode: 403, error: "Owner hanya dapat mengontrol mesin mitra sendiri" };
    }
  } else if (actor?.type === "backoffice") {
    idMitra = Number(req.body.idMitra);
    cabangId = Number(req.body.cabangId);
  } else {
    idMitra = Number(req.user?.idMitra);
    cabangId = Number(req.user?.cabang_id || req.user?.cabangId);
  }

  if (!isPositiveInteger(idMitra) || !isPositiveInteger(cabangId)) {
    return { statusCode: 400, error: "idMitra dan cabangId wajib diisi dan harus integer lebih dari 0" };
  }

  const cabangValid = await TransaksiModel.isActiveCabangForMitra(idMitra, cabangId);
  if (!cabangValid) {
    return { statusCode: 403, error: "Cabang tidak sesuai dengan mitra atau tidak aktif" };
  }

  const resolvedActor = actor || {
    type: "kasir",
    id: req.user?.id,
    username: req.user?.username,
  };

  if (!isPositiveInteger(resolvedActor.id)) {
    return { statusCode: 401, error: "Token tidak valid" };
  }

  return {
    idMitra,
    cabangId,
    kasirId: resolvedActor.type === "kasir" ? Number(resolvedActor.id) : null,
    actor: resolvedActor,
  };
};

const getJumlahTransaksi = async (req, res) => {
  const idMitra = req.user ? req.user.idMitra : null;
  const cabangId = req.user ? (req.user.cabang_id || req.user.cabangId) : null;
  const filter = getRequestDateFilter(req);

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
    const data = await TransaksiModel.getJumlahTransaksi(cabangId, idMitra, filter);

    res.status(200).json({
      success: "Get Data Transaksi Success",
      data: data,
    });
  } catch (error) {
    console.error("Error Get Jumlah Transaksi:", error);
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const getPendingTransaksi = async (req, res) => {
  const idMitra = req.user ? req.user.idMitra : null;
  const cabangId = req.user ? (req.user.cabang_id || req.user.cabangId) : null;

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
    const rows = await TransaksiModel.getPendingTransaksi(cabangId, idMitra);

    const data = rows.map((row) => {
      const layananPending = row.layananPending || "";
      const waktuMasuk = new Date(row.waktuOrder);

      return {
        idDetailPending: row.idDetailPending,
        invoiceNumber: row.invoiceNumber,
        jenisLayanan: layananPending.toUpperCase(),
        waktuOrderLengkap: row.waktuOrder ? waktuMasuk.toISOString() : "",
        infoMesinAsal: row.idMesinAsal
          ? `Mesin ID: ${row.idMesinAsal}`
          : (layananPending === "cuci" ? "Baru Masuk" : "Tidak Diketahui"),
      };
    });

    res.status(200).json({
      success: "Get Data Antrian Transaksi Success",
      data: data,
    });
  } catch (error) {
    console.error("Error Get Antrean:", error);
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const createTransaksi = async (req, res) => {
  const { totalBayar, metodePembayaran, items } = req.body;
  const idMitra = req.user ? req.user.idMitra : null;
  const cabangId = req.user ? (req.user.cabang_id || req.user.cabangId) : null;
  const idUserMobile = req.user ? req.user.id : null;

  if (!idMitra || !cabangId || !idUserMobile) {
    return res.status(401).json({
      error: "Token tidak valid",
    });
  }

  if (!isPositiveNumber(totalBayar)) {
    return res.status(400).json({
      error: "totalBayar wajib diisi dan harus lebih dari 0",
    });
  }

  if (!metodePembayaran) {
    return res.status(400).json({
      error: "metodePembayaran wajib diisi",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "items wajib diisi dan minimal 1 item",
    });
  }

  for (const item of items) {
    if (!item || typeof item !== "object") {
      return res.status(400).json({
        error: "Format item tidak valid",
      });
    }

    if (!validJenisLayanan.includes(item.jenisLayanan)) {
      return res.status(400).json({
        error: "jenisLayanan tidak valid",
      });
    }

    if (!Number.isInteger(Number(item.jumlah)) || Number(item.jumlah) <= 0) {
      return res.status(400).json({
        error: "jumlah wajib diisi dan harus integer lebih dari 0",
      });
    }

    if (!isNonNegativeNumber(item.subtotal)) {
      return res.status(400).json({
        error: "subtotal wajib diisi dan tidak boleh negatif",
      });
    }

    if (
      item.jenisLayanan === "addon_barang" &&
      (!Number.isInteger(Number(item.itemId)) || Number(item.itemId) <= 0)
    ) {
      return res.status(400).json({
        error: "itemId wajib diisi untuk addon_barang",
      });
    }
  }

  const totalSubtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  if (Math.abs(Number(totalBayar) - totalSubtotal) > 0.01) {
    return res.status(400).json({
      error: "totalBayar harus sama dengan total subtotal items",
    });
  }

  try {
    const data = await TransaksiModel.createTransaksi({
      idMitra,
      cabangId,
      idUserMobile,
      totalBayar,
      metodePembayaran,
      items,
    });

    res.status(201).json({
      success: "Create Data Transaksi Success",
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

    if (
      error.message === "Item addon harus bertipe stok" ||
      error.message === "Stok cabang tidak ditemukan" ||
      error.message === "Stok tidak mencukupi"
    ) {
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

const startMesin = async (req, res) => {
  const { mesinId, invoiceNumber } = req.body;

  if (!isPositiveInteger(mesinId)) {
    return res.status(400).json({
      error: "mesinId wajib diisi dan harus integer lebih dari 0",
    });
  }

  if (!invoiceNumber || typeof invoiceNumber !== "string" || invoiceNumber.trim() === "") {
    return res.status(400).json({
      error: "invoiceNumber wajib diisi",
    });
  }

  try {
    const context = await getMachineControlContext(req);
    if (context.error) {
      return res.status(context.statusCode).json({ error: context.error });
    }

    await TransaksiModel.startMesin({
      ...context,
      mesinId: Number(mesinId),
      invoiceNumber: invoiceNumber.trim(),
    });

    return res.status(200).json({
      success: "Start Mesin Success",
      data: null,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
      });
    }

    console.error("Error Start Mesin:", error);
    return res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const stopMesin = async (req, res) => {
  const { mesinId, invoiceNumber } = req.body;

  if (!isPositiveInteger(mesinId)) {
    return res.status(400).json({
      error: "mesinId wajib diisi dan harus integer lebih dari 0",
    });
  }

  if (invoiceNumber && (typeof invoiceNumber !== "string" || invoiceNumber.trim() === "")) {
    return res.status(400).json({
      error: "invoiceNumber tidak valid",
    });
  }

  try {
    const context = await getMachineControlContext(req);
    if (context.error) {
      return res.status(context.statusCode).json({ error: context.error });
    }

    await TransaksiModel.stopMesin({
      ...context,
      mesinId: Number(mesinId),
      invoiceNumber: invoiceNumber ? invoiceNumber.trim() : null,
    });

    return res.status(200).json({
      success: "Stop Mesin Success",
      data: null,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
      });
    }

    console.error("Error Stop Mesin:", error);
    return res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  getJumlahTransaksi,
  getPendingTransaksi,
  createTransaksi,
  startMesin,
  stopMesin,
};
