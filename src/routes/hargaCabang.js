const express = require("express");
const HargaCabangController = require("../controller/hargaCabang");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileOwner } = require("../middleware/authorization");

const router = express.Router();

// POST - Create / Update Setting Harga Layanan per Cabang
router.post("/", authenticateMobile, requireMobileOwner, HargaCabangController.createSettingHarga);

// GET - Get Setting Harga Layanan per Cabang
router.get("/", authenticateMobile, requireMobileOwner, HargaCabangController.getSettingHarga);

module.exports = router;
