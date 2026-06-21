const express = require("express");
const HistoryController = require("../controller/history");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// GET - Get History Transaksi per Cabang
router.get("/transaksi", authenticateMobile, HistoryController.getHistoryTransaksi);
router.get("/mesin", authenticateMobile, HistoryController.getHistoryMesin);

module.exports = router;