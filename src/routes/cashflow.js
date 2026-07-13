const express = require("express");
const CashflowController = require("../controller/cashflow");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileOwner } = require("../middleware/authorization");

const router = express.Router();

// GET - Get Cashflow Harian per Cabang
router.get("/cashflow", authenticateMobile, requireMobileOwner, CashflowController.getCashflow);
router.get("/cashflow/pendapatan", authenticateMobile, requireMobileOwner, CashflowController.getPendapatan);
router.get("/cashflow/pengeluaran", authenticateMobile, CashflowController.getListPengeluaran);
router.get("/cashflow/pengeluaran/:id", authenticateMobile, CashflowController.getPengeluaranById);

// POST - Create Pengeluaran (Kasir)
router.post("/cashflow/pengeluaran", authenticateMobile, CashflowController.createPengeluaran);

// UPDATE - Update Pengeluaran
router.put("/cashflow/pengeluaran/:id", authenticateMobile, CashflowController.updatePengeluaran);

// DELETE - Delete Pengeluaran
router.delete("/cashflow/pengeluaran/:id", authenticateMobile, CashflowController.deletePengeluaran);

module.exports = router;
