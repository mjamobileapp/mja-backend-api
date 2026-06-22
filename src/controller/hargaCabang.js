const HargaCabangModel = require("../models/hargaCabang");

const createSettingHarga = async (req, res) => {
  const { cabangId, item } = req.body;
  const idMitra = req.user ? req.user.idMitra : null;
  const createdBy = req.user ? req.user.username || req.user.id : null;

  console.log("CREATE SETTING HARGA REQUEST:", { idMitra, cabangId, item });

  if (!idMitra) {
    return res.status(400).json({
      message: "idMitra tidak ditemukan di token",
    });
  }

  if (!cabangId) {
    return res.status(400).json({
      message: "cabangId tidak ditemukan di request body",
    });
  }

  if (!item || !Array.isArray(item) || item.length === 0) {
    return res.status(400).json({
      message: "item harus berupa array dan tidak boleh kosong",
    });
  }

  // Validasi setiap item
  for (let i = 0; i < item.length; i++) {
    const it = item[i];
    if (!it.jenisLayanan) {
      return res.status(400).json({
        message: `jenisLayanan wajib diisi untuk item ke-${i + 1}`,
      });
    }
    if (!['cuci', 'kering', 'addon_barang'].includes(it.jenisLayanan)) {
      return res.status(400).json({
        message: `jenisLayanan harus 'cuci', 'kering', atau 'addon_barang' untuk item ke-${i + 1}`,
      });
    }
    if (it.jenisLayanan === 'addon_barang' && !it.itemId) {
      return res.status(400).json({
        message: `itemId wajib diisi untuk jenisLayanan 'addon_barang' di item ke-${i + 1}`,
      });
    }
    if (!it.harga && it.harga !== 0) {
      return res.status(400).json({
        message: `harga wajib diisi untuk item ke-${i + 1}`,
      });
    }
  }

  try {
    const data = await HargaCabangModel.createSettingHarga(idMitra, cabangId, item, createdBy);
    res.status(201).json({
      message: "Create Setting Harga Layanan successful",
      data: data,
    });
  } catch (error) {
    if (
      error.message === "Mitra tidak ditemukan" ||
      error.message === "Cabang tidak ditemukan"
    ) {
      return res.status(404).json({
        message: error.message,
      });
    }
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  createSettingHarga,
};