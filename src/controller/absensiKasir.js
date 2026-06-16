const AbsensiKasirModel = require("../models/absensiKasir");

const getAbsensiKasir = async (req, res) => {
  const { cabangId } = req.query;

  if (!cabangId) {
    return res.status(400).json({
      error: "Parameter cabangId diperlukan",
    });
  }

  try {
    const [data] = await AbsensiKasirModel.getAbsensiKasir(cabangId);

    const mappedData = data.map((item) => ({
      id: item.absensiId,
      tanggalShift: item.tanggalShift,
      namaKasir: item.namaKasir,
      jamMasuk: item.jamMasuk,
      jamPulang: item.jamPulang,
    }));

    res.json({
      message: "Get Data Absensi Kasir Success",
      data: mappedData,
    });
  } catch (error) {
    console.error("Error fetching absensi kasir:", error);
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  getAbsensiKasir,
};