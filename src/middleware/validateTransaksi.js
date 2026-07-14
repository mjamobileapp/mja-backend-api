const { normalizeTransaksiPayload } = require("../domain/transaksi");

const validateTransaksiPayload = (req, res, next) => {
  try {
    req.validatedBody = normalizeTransaksiPayload(req.body);
    return next();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

module.exports = { validateTransaksiPayload };
