const express = require("express");
const TransaksiController = require("../controller/transaksi");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

router.get("/pending", authenticateMobile, TransaksiController.getPendingTransaksi);
router.get("/", authenticateMobile, TransaksiController.getJumlahTransaksi);
router.post("/", authenticateMobile, TransaksiController.createTransaksi);
router.post("/startmesin", authenticateMobile, TransaksiController.startMesin);
router.post("/stopmesin", authenticateMobile, TransaksiController.stopMesin);

module.exports = router;
