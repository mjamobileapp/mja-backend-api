const express = require("express");
const ReportController = require("../controller/report");
const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();
router.get("/audit-logs", authenticate, catchAsync(ReportController.getAuditLogs));

module.exports = router;
