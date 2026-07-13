const express = require("express");
const MobileController = require("../controller/mobile");
const NotifikasiController = require("../controller/notifikasi");
const { authenticateMobile } = require("../middleware/authMobile");
const { publicActivationRateLimiter, publicLoginRateLimiter } = require("../middleware/publicAuthRateLimit");

const router = express.Router();

// Public route (tanpa authenticate middleware)
router.post("/login", publicLoginRateLimiter, MobileController.loginUser);
router.post("/activateaccount", publicActivationRateLimiter, MobileController.activateAccount);
router.post("/logout", authenticateMobile, MobileController.logoutUser);

// GET - Get Notifikasi Mobile
router.get("/notifications", authenticateMobile, NotifikasiController.getNotifikasi);

// PUT - Mark as Read Notifikasi
router.put("/notifications/:id/read", authenticateMobile, NotifikasiController.markAsRead);

module.exports = router;
