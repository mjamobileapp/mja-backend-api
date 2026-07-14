const express = require("express");
const HargaCabangController = require("../controller/hargaCabang");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileOwner } = require("../middleware/authorization");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// POST - Create / Update Setting Harga Layanan per Cabang
router.post("/", authenticateMobile, requireMobileOwner, catchAsync(HargaCabangController.createSettingHarga));

// GET - Get Setting Harga Layanan per Cabang
router.get("/", authenticateMobile, requireMobileOwner, catchAsync(HargaCabangController.getSettingHarga));

module.exports = router;
