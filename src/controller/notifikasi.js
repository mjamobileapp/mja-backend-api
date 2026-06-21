const NotifikasiModel = require("../models/notifikasi");

const getNotifikasi = async (req, res) => {
  try {
    const userRole = req.user.role;
    const idMitra = req.user.idMitra || req.user.mitra_id;
    const userCabangId = req.user.cabang_id || req.user.cabangId;
    const { filterCabangId } = req.query;

    console.log("GET NOTIFIKASI REQUEST:", { userRole, idMitra, userCabangId, filterCabangId });

    if (!idMitra) {
      return res.status(400).json({
        error: "idMitra tidak ditemukan di token",
      });
    }

    let cabangId = null;
    if (userRole === 'kasir') {
      cabangId = userCabangId;
    }

    const rows = await NotifikasiModel.getNotifikasi(idMitra, cabangId, filterCabangId);

    let unreadCount = 0;
    const listNotifikasi = rows.map(row => {
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

    res.json({
      success: true,
      meta: {
        unreadCount,
        totalData: listNotifikasi.length,
      },
      data: listNotifikasi,
    });
  } catch (error) {
    console.error("Notifikasi Controller Error (getNotifikasi):", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getNotifikasi,
};