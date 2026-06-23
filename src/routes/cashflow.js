const express = require("express");
const CashflowController = require("../controller/cashflow");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// GET - Get Cashflow Harian per Cabang
router.get("/cashflow", authenticateMobile, CashflowController.getCashflow);
router.get("/cashflow/pendapatan", authenticateMobile, CashflowController.getPendapatan);
router.get("/cashflow/pengeluaran", authenticateMobile, CashflowController.getListPengeluaran);
router.get("/cashflow/pengeluaran/:id", authenticateMobile, CashflowController.getPengeluaranById);

// POST - Create Pengeluaran (Kasir)
router.post("/cashflow/pengeluaran", authenticateMobile, CashflowController.createPengeluaran);

// UPDATE - Update Pengeluaran
router.put("/cashflow/pengeluaran/:id", authenticateMobile, CashflowController.updatePengeluaran);

module.exports = router;
