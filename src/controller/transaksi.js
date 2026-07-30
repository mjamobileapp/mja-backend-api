const TransaksiModel = require("../models/transaksi");
const { normalizeTransaksiPayload } = require("../domain/transaksi");
const { MACHINE_CONTROL_ACTOR_TYPES } = require("../domain/machineControl");
const { MOBILE_ROLES, normalizeMobileRole } = require("../domain/auth");
const TransaksiService = require("../services/transaksi");
const { createHttpError } = require("../utils/httpError");

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const getRequestDateFilter = (req) => req.query.filter ?? req.query.periode ?? req.query.tanggal ?? "";

const getMachineControlContext = async (req) => {
  const actor = req.machineControlActor;
  let idMitra;
  let cabangId;

  if (actor?.type === MACHINE_CONTROL_ACTOR_TYPES.OWNER) {
    idMitra = Number(req.user.idMitra);
    cabangId = Number(req.body.cabangId);

    if (req.body.idMitra !== undefined && Number(req.body.idMitra) !== idMitra) {
      throw createHttpError(403, "Owner hanya dapat mengontrol mesin mitra sendiri", "BRANCH_SCOPE_FORBIDDEN");
    }
  } else if (actor?.type === MACHINE_CONTROL_ACTOR_TYPES.BACKOFFICE) {
    idMitra = Number(req.body.idMitra);
    cabangId = Number(req.body.cabangId);
  } else {
    idMitra = Number(req.user?.idMitra);
    cabangId = Number(req.user?.cabang_id || req.user?.cabangId);
  }

  if (!isPositiveInteger(idMitra) || !isPositiveInteger(cabangId)) {
    throw createHttpError(
      400,
      "idMitra dan cabangId wajib diisi dan harus integer lebih dari 0",
      "MACHINE_CONTROL_VALIDATION_ERROR"
    );
  }

  const cabangValid = await TransaksiModel.isActiveCabangForMitra(idMitra, cabangId);
  if (!cabangValid) {
    throw createHttpError(403, "Cabang tidak sesuai dengan mitra atau tidak aktif", "BRANCH_SCOPE_FORBIDDEN");
  }

  const resolvedActor = actor || {
    type: MACHINE_CONTROL_ACTOR_TYPES.KASIR,
    id: req.user?.id,
    username: req.user?.username,
  };

  if (!isPositiveInteger(resolvedActor.id)) {
    throw createHttpError(401, "Token tidak valid", "UNAUTHORIZED");
  }

  return {
    idMitra,
    cabangId,
    kasirId: resolvedActor.type === MACHINE_CONTROL_ACTOR_TYPES.KASIR ? Number(resolvedActor.id) : null,
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

  const data = await TransaksiModel.getJumlahTransaksi(cabangId, idMitra, filter);
  return res.status(200).json({ success: "Get Data Transaksi Success", data });
};

const getPendingTransaksi = async (req, res) => {
  const idMitra = req.user ? req.user.idMitra : null;
  const role = normalizeMobileRole(req.user?.role);
  const cabangId = role === MOBILE_ROLES.OWNER
    ? req.query.cabangId
    : (req.user ? (req.user.cabang_id || req.user.cabangId) : null);

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

  if (role === MOBILE_ROLES.OWNER && !await TransaksiModel.isActiveCabangForMitra(idMitra, cabangId)) {
    return res.status(403).json({
      error: "Cabang tidak sesuai dengan mitra atau tidak aktif",
      code: "BRANCH_SCOPE_FORBIDDEN",
    });
  }

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

  return res.status(200).json({ success: "Get Data Antrian Transaksi Success", data });
};

const createTransaksi = async (req, res) => {
  const idMitra = req.user ? req.user.idMitra : null;
  const cabangId = req.user ? (req.user.cabang_id || req.user.cabangId) : null;
  const idUserMobile = req.user ? req.user.id : null;

  if (!idMitra || !cabangId || !idUserMobile) {
    return res.status(401).json({
      error: "Token tidak valid",
    });
  }

  let payload;
  try {
    payload = req.validatedBody || normalizeTransaksiPayload(req.body);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }

  const data = await TransaksiService.createTransaksi({
    idMitra,
    cabangId,
    idUserMobile,
    payload,
  }, req.log);

  res.status(201).json({
    success: "Create Data Transaksi Success",
    data: data,
  });
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

  const context = await getMachineControlContext(req);
  await TransaksiModel.startMesin({
    ...context,
    mesinId: Number(mesinId),
    invoiceNumber: invoiceNumber.trim(),
  }, req.log);

  return res.status(200).json({
    success: "Start Mesin Success",
    data: null,
  });
};

const startMesinByOwner = async (req, res) => {
  const { mesinId } = req.body;

  if (!isPositiveInteger(mesinId)) {
    return res.status(400).json({
      error: "mesinId wajib diisi dan harus integer lebih dari 0",
    });
  }

  const context = await getMachineControlContext(req);
  await TransaksiModel.startMesinByOwner({
    ...context,
    mesinId: Number(mesinId),
  }, req.log);

  return res.status(200).json({
    success: "Start Mesin By Owner Success",
    data: null,
  });
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

  const context = await getMachineControlContext(req);
  await TransaksiModel.stopMesin({
    ...context,
    mesinId: Number(mesinId),
    invoiceNumber: invoiceNumber ? invoiceNumber.trim() : null,
  }, req.log);

  return res.status(200).json({
    success: "Stop Mesin Success",
    data: null,
  });
};

const stopMesinByOwner = async (req, res) => {
  const { mesinId } = req.body;

  if (!isPositiveInteger(mesinId)) {
    return res.status(400).json({
      error: "mesinId wajib diisi dan harus integer lebih dari 0",
    });
  }

  const context = await getMachineControlContext(req);
  await TransaksiModel.stopMesinByOwner({
    ...context,
    mesinId: Number(mesinId),
  }, req.log);

  return res.status(200).json({
    success: "Stop Mesin By Owner Success",
    data: null,
  });
};

module.exports = {
  getJumlahTransaksi,
  getPendingTransaksi,
  createTransaksi,
  startMesin,
  startMesinByOwner,
  stopMesin,
  stopMesinByOwner,
};
