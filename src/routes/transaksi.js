const express = require("express");
const TransaksiController = require("../controller/transaksi");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileKasir } = require("../middleware/authorization");
const { validateTransaksiPayload } = require("../middleware/validateTransaksi");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

router.get("/pending", authenticateMobile, requireMobileKasir, catchAsync(TransaksiController.getPendingTransaksi));
router.get("/", authenticateMobile, requireMobileKasir, catchAsync(TransaksiController.getJumlahTransaksi));
router.post("/", authenticateMobile, requireMobileKasir, validateTransaksiPayload, catchAsync(TransaksiController.createTransaksi));
router.post("/startmesin", authenticateMobile, requireMobileKasir, TransaksiController.startMesin);
router.post("/stopmesin", authenticateMobile, requireMobileKasir, TransaksiController.stopMesin);

module.exports = router;
