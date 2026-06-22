const express = require("express");
const HargaCabangController = require("../controller/hargaCabang");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// POST - Create / Update Setting Harga Layanan per Cabang
router.post("/", authenticateMobile, HargaCabangController.createSettingHarga);

// GET - Get Setting Harga Layanan per Cabang
router.get("/", authenticateMobile, HargaCabangController.getSettingHarga);

module.exports = router;