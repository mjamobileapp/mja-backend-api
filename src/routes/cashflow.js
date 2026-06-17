const express = require("express");
const CashflowController = require("../controller/cashflow");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// GET - Get Cashflow Harian per Cabang
router.get("/cashflow", authenticateMobile, CashflowController.getCashflow);

module.exports = router;