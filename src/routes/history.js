const express = require("express");
const HistoryController = require("../controller/history");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileOwner } = require("../middleware/authorization");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// GET - Get History Transaksi per Cabang
router.get("/transaksi", authenticateMobile, requireMobileOwner, catchAsync(HistoryController.getHistoryTransaksi));
router.get("/mesin", authenticateMobile, requireMobileOwner, catchAsync(HistoryController.getHistoryMesin));

module.exports = router;
