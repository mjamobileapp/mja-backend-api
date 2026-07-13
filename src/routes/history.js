const express = require("express");
const HistoryController = require("../controller/history");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileOwner } = require("../middleware/authorization");

const router = express.Router();

// GET - Get History Transaksi per Cabang
router.get("/transaksi", authenticateMobile, requireMobileOwner, HistoryController.getHistoryTransaksi);
router.get("/mesin", authenticateMobile, requireMobileOwner, HistoryController.getHistoryMesin);

module.exports = router;
