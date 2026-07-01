const express = require("express");
const TransaksiController = require("../controller/transaksi");
const { authenticateMobileWithErrorResponse } = require("../middleware/authMobile");

const router = express.Router();

router.post("/startmesin", authenticateMobileWithErrorResponse, TransaksiController.startMesin);
router.post("/stopmesin", authenticateMobileWithErrorResponse, TransaksiController.stopMesin);

module.exports = router;
