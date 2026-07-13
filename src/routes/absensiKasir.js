const express = require("express");
const KasirController = require("../controller/kasir");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileKasir } = require("../middleware/authorization");

const router = express.Router();

router.get("/", authenticateMobile, requireMobileKasir, KasirController.getAbsensiKasir);

module.exports = router;

