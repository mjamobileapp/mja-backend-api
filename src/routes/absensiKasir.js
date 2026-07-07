const express = require("express");
const KasirController = require("../controller/kasir");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

router.get("/", authenticateMobile, KasirController.getAbsensiKasir);

module.exports = router;

