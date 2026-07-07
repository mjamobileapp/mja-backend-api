const express = require("express");
const HistoryController = require("../controller/history");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// GET - Get History Transaksi Kasir
router.get("/transaksi", authenticateMobile, HistoryController.getHistoryTransaksiKasir);

module.exports = router;
