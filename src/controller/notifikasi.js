const NotifikasiModel = require("../models/notifikasi");

const getNotifikasi = async (req, res) => {
  const userRole = req.user.role;
  const idMitra = req.user.idMitra || req.user.mitra_id;
  const userCabangId = req.user.cabang_id || req.user.cabangId;
  const { filterCabangId } = req.query;

  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  let cabangId = null;
  if (userRole === "kasir") {
    cabangId = userCabangId;
  }

  const rows = await NotifikasiModel.getNotifikasi(idMitra, cabangId, filterCabangId);

  let unreadCount = 0;
  const listNotifikasi = rows.map((row) => {
    if (!row.isRead) unreadCount++;
    return {
      idNotif: row.id,
      cabangId: row.cabangId,
      tipe: row.tipe,
      referenceId: row.referenceId,
      judul: row.judul,
      pesan: row.pesan,
      isRead: Boolean(row.isRead),
      waktu: new Date(row.createdDate).toISOString(),
    };
  });

  return res.json({
    success: true,
    meta: {
      unreadCount,
      totalData: listNotifikasi.length,
    },
    data: listNotifikasi,
  });
};

const markAsRead = async (req, res) => {
  const { id } = req.params;
  const idMitra = req.user.idMitra || req.user.mitra_id;
  const role = String(req.user.role || "").toLowerCase();
  const cabangId = role === "kasir" ? req.user.cabang_id || req.user.cabangId : null;

  if (!idMitra) {
    return res.status(400).json({
      error: "idMitra tidak ditemukan di token",
    });
  }

  const data = await NotifikasiModel.markAsRead(id, idMitra, cabangId);
  return res.status(200).json({
    success: "Mark as Read Success",
    data: data,
  });
};

module.exports = {
  getNotifikasi,
  markAsRead,
};
