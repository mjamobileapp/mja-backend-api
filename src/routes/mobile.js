const express = require("express");
const MobileController = require("../controller/mobile");
const NotifikasiController = require("../controller/notifikasi");
const { authenticateMobile } = require("../middleware/authMobile");

const router = express.Router();

// Public route (tanpa authenticate middleware)
router.post("/login", MobileController.loginUser);
router.post("/activateaccount", MobileController.activateAccount);
router.post("/logout", authenticateMobile, MobileController.logoutUser);

// GET - Get Notifikasi Mobile
router.get("/notifications", authenticateMobile, NotifikasiController.getNotifikasi);

module.exports = router;
