const express = require("express");
const DashboardController = require("../controller/dashboard");
const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// Pastikan tidak ada /api/backoffice/dashboard di sini, cukup /getMitra
router.get("/getmitra", authenticate, catchAsync(DashboardController.getMitra));

// GET CABANG - GET
router.get("/getcabang", authenticate, catchAsync(DashboardController.getCabang));

// GET MESIN - GET
router.get("/getmesin", authenticate, catchAsync(DashboardController.getMesin));

module.exports = router;
