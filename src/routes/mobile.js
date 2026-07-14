const express = require("express");
const MobileController = require("../controller/mobile");
const NotifikasiController = require("../controller/notifikasi");
const { authenticateMobile } = require("../middleware/authMobile");
const { publicActivationRateLimiter, publicLoginRateLimiter } = require("../middleware/publicAuthRateLimit");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// Public route (tanpa authenticate middleware)
router.post("/login", publicLoginRateLimiter, catchAsync(MobileController.loginUser));
router.post("/activateaccount", publicActivationRateLimiter, catchAsync(MobileController.activateAccount));
router.post("/logout", authenticateMobile, catchAsync(MobileController.logoutUser));

// GET - Get Notifikasi Mobile
router.get("/notifications", authenticateMobile, catchAsync(NotifikasiController.getNotifikasi));

// PUT - Mark as Read Notifikasi
router.put("/notifications/:id/read", authenticateMobile, catchAsync(NotifikasiController.markAsRead));

module.exports = router;
