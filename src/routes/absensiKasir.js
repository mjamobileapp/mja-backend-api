const express = require("express");
const AbsensiKasirController = require("../controller/absensiKasir");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// GET - Get Absensi Kasir
router.get("/absensikasir", authenticateMobile, AbsensiKasirController.getAbsensiKasir);

module.exports = router;