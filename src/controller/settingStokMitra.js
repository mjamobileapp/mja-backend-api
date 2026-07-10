const SettingStokModel = require("../models/settingStokMitra");

const isOwner = (user) => String(user?.role || "").toLowerCase() === "owner";

const createNewSetting = async (req, res) => {
  const { body } = req;
  const user = req.user;

  if (!isOwner(user)) {
    return res.status(403).json({ 
      message: "Akses ditolak: Hanya akun Owner yang diizinkan untuk mengatur stok minimum" 
    });
  }

  try {
    const idMitra = req.user.idMitra;
    const createdBy = req.user.username;
    const { item: items } = body;

    // 1. Validasi level Root (item array)
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Bad request, item must be an array" });
    }

    // 2. Iterasi setiap Item di dalam array item
    for (const [index, itemDetail] of items.entries()) {
      const { itemId, batasMinimum } = itemDetail;

      // Validasi level Item
      if (itemId === undefined || batasMinimum === undefined) {
        return res.status(400).json({ 
          message: `Bad request, missing itemId or batasMinimum at index ${index}` 
        });
      }
    }

    // 3. Jalankan bulk insert dalam satu transaksi di level model untuk menghindari deadlock
    const result = await SettingStokModel.createBulkSettings(idMitra, items, createdBy);
    res.status(201).json({ message: "CREATE setting stok success", data: result });
  } catch (error) {
    if (["Mitra tidak ditemukan atau tidak aktif", "Item tidak ditemukan atau tidak aktif"].includes(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const updateSetting = async (req, res) => {
  const { id } = req.params;
  const { body } = req;
  const user = req.user;

  // 1. Validasi Role: Harus Owner
  if (!isOwner(user)) {
    return res.status(403).json({ message: "Akses ditolak: Hanya akun Owner yang diizinkan" });
  }

  // Perbaikan PR #70: Pastikan batasMinimum: 0 tidak dianggap missing
  if (body.batasMinimum === undefined || body.batasMinimum === null) {
    return res.status(400).json({ message: "Bad request, missing batasMinimum" });
  }

  try {
    // 2. Validasi Ownership: Pastikan data yang diupdate milik Mitra yang login
    const existingSetting = await SettingStokModel.getSettingById(id);
    if (!existingSetting) return res.status(404).json({ error: "data not found" });

    if (Number(existingSetting.idMitra) !== Number(user.idMitra)) {
      return res.status(403).json({ 
        message: "Akses ditolak: Anda tidak memiliki izin untuk mengubah data mitra lain" 
      });
    }

    const data = await SettingStokModel.updateSetting(id, { ...body, updatedBy: user.username });
    res.status(200).json({ message: "UPDATE setting stok success", data });
  } catch (error) {
    if (error.message === "data not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const getAllSettings = async (req, res) => {
  const user = req.user;

  // Validasi Role: Harus Owner
  if (!isOwner(user)) {
    return res.status(403).json({ message: "Akses ditolak: Hanya akun Owner yang diizinkan" });
  }

  try {
    // Otomatis filter berdasarkan idMitra dari token agar lebih aman
    const data = await SettingStokModel.getAllSettings(user.idMitra);
    res.status(200).json({ message: "Get All success", data });
  } catch (error) {
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

const getSettingByIdMitra = async (req, res) => {
  const { idMitra } = req.params;
  const user = req.user;

  // 1. Validasi Role: Harus Owner
  if (!isOwner(user)) {
    return res.status(403).json({ message: "Akses ditolak: Hanya akun Owner yang diizinkan" });
  }

  // 2. Validasi Ownership: idMitra di URL harus sama dengan idMitra di token
  if (Number(idMitra) !== Number(user.idMitra)) {
    return res.status(403).json({ 
      message: "Akses ditolak: Anda tidak memiliki izin untuk melihat data mitra lain" 
    });
  }

  try {
    const data = await SettingStokModel.getSettingByIdMitra(idMitra);
    res.status(200).json({ message: "Get success", data });
  } catch (error) {
    res.status(500).json({ message: "Server Error", serverMessage: error.message });
  }
};

module.exports = {
  createNewSetting,
  updateSetting,
  getAllSettings,
  getSettingByIdMitra
};
