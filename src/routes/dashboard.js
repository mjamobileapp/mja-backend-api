const express = require("express");
const DashboardController = require("../controller/dashboard");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Pastikan tidak ada /api/backoffice/dashboard di sini, cukup /getMitra
router.get("/getmitra", authenticate, DashboardController.getMitra);

// GET CABANG - GET
router.get("/getcabang", authenticate, DashboardController.getCabang);

// GET MESIN - GET
router.get("/getmesin", authenticate, DashboardController.getMesin);

module.exports = router;