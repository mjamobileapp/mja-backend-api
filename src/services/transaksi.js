const TransaksiModel = require("../models/transaksi");

const createTransaksi = async (
  { idMitra, cabangId, idUserMobile, payload },
  loggerOrModel,
  injectedModel = TransaksiModel
) => {
  const isModel = loggerOrModel && typeof loggerOrModel.createTransaksi === "function";
  const model = isModel ? loggerOrModel : injectedModel;
  const logger = isModel ? undefined : loggerOrModel;
  return model.createTransaksi({ idMitra, cabangId, idUserMobile, ...payload }, logger);
};

module.exports = { createTransaksi };
