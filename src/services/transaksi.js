const TransaksiModel = require("../models/transaksi");

const createTransaksi = async ({ idMitra, cabangId, idUserMobile, payload }, model = TransaksiModel) =>
  model.createTransaksi({ idMitra, cabangId, idUserMobile, ...payload });

module.exports = { createTransaksi };
