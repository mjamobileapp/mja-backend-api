const express = require("express");
const AppVersionController = require("../controller/appVersion");
const { authenticate } = require("../middleware/auth");
const { publicAppVersionRateLimiter } = require("../middleware/publicAuthRateLimit");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

router.put("/", authenticate, catchAsync(AppVersionController.updateAppVersions));
router.get("/", publicAppVersionRateLimiter, catchAsync(AppVersionController.getAppVersions));

module.exports = router;
