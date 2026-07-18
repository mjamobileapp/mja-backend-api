const express = require("express");
const KasirController = require("../controller/kasir");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileOwnerOrKasirCabang } = require("../middleware/authorization");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

router.get(
  "/",
  authenticateMobile,
  requireMobileOwnerOrKasirCabang({ allowKasirTokenCabang: true }),
  catchAsync(KasirController.getAbsensiKasir)
);

module.exports = router;

