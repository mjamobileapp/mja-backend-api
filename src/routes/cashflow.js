const express = require("express");
const CashflowController = require("../controller/cashflow");
const { authenticateMobile } = require("../middleware/authMobile");
const { requireMobileOwner } = require("../middleware/authorization");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// GET - Get Cashflow Harian per Cabang
router.get("/cashflow", authenticateMobile, requireMobileOwner, catchAsync(CashflowController.getCashflow));
router.get("/cashflow/pendapatan", authenticateMobile, requireMobileOwner, catchAsync(CashflowController.getPendapatan));
router.get("/cashflow/pengeluaran", authenticateMobile, catchAsync(CashflowController.getListPengeluaran));
router.get("/cashflow/pengeluaran/:id", authenticateMobile, catchAsync(CashflowController.getPengeluaranById));

// POST - Create Pengeluaran (Kasir)
router.post("/cashflow/pengeluaran", authenticateMobile, catchAsync(CashflowController.createPengeluaran));

// UPDATE - Update Pengeluaran
router.put("/cashflow/pengeluaran/:id", authenticateMobile, catchAsync(CashflowController.updatePengeluaran));

// DELETE - Delete Pengeluaran
router.delete("/cashflow/pengeluaran/:id", authenticateMobile, catchAsync(CashflowController.deletePengeluaran));

module.exports = router;
