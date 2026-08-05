const express = require("express");
const ReportController = require("../controller/report");
const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();
router.get("/summary", authenticate, catchAsync(ReportController.getSummary));
router.get("/trend", authenticate, catchAsync(ReportController.getTrend));
router.get("/audit-logs", authenticate, catchAsync(ReportController.getAuditLogs));

module.exports = router;
