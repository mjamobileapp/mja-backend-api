const express = require("express");
const HistoryController = require("../controller/history");
const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// GET - Get History Log Eksekusi Mesin (Backoffice)
router.get("/mesin", authenticate, catchAsync(HistoryController.getHistoryMesinBackoffice));

module.exports = router;
